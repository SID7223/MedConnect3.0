package app.medconnect.routes

import app.medconnect.Services
import app.medconnect.http.bool
import app.medconnect.http.fail
import app.medconnect.http.int
import app.medconnect.http.jsonBody
import app.medconnect.http.ok
import app.medconnect.http.param
import app.medconnect.http.str
import app.medconnect.http.userId
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.httpMethod
import io.ktor.server.routing.Route
import io.ktor.server.routing.route
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * `GET /api/daily?date=YYYY-MM-DD` + `POST /api/daily` — ST7 Daily practice.
 *
 * GET returns the three cards for the date (term, drill, one-liner) with the
 * user's done flags. term/drill fall back to the most recent approved item
 * when a date has no row. One-liners rotate: the user is served an UNANSWERED
 * approved case first (biased to their Setup specialty), falling back to the
 * most recent once the pool is exhausted.
 * POST `complete { itemId }` marks done; `save_term { itemId }` copies the
 * term into the user's Cards deck; `answer_oneliner { itemId, entries }`
 * records the user's differentials and runs the recommendation engine
 * (confidence 1-5 per differential, personalised from MCQ/study activity).
 */
fun Route.dailyRoutes(s: Services) {
    route("/daily") {
        handle {
            val uid = call.userId(s.tokens)
                ?: return@handle call.fail(HttpStatusCode.Unauthorized, "Not authenticated")

            if (call.request.httpMethod == HttpMethod.Get) {
                val date = call.param("date")?.takeIf { DATE_RE.matches(it) }
                    ?: java.time.LocalDate.now().toString()
                val specialty = userSpecialty(s, uid)
                val cards = TYPES.mapNotNull { type ->
                    if (type == "one-liner") oneLinerCard(s, uid, date, specialty)
                    else cardFor(s, uid, type, date)
                }
                return@handle call.ok(
                    JsonObject(
                        mapOf(
                            "date" to JsonPrimitive(date),
                            "cards" to JsonArray(cards),
                        ),
                    ),
                )
            }

            if (call.request.httpMethod != HttpMethod.Post) {
                return@handle call.fail(HttpStatusCode.MethodNotAllowed, "Method not allowed")
            }
            val b = call.jsonBody()
            when (b.str("action")) {
                // Team bulk-upload (CSV via scripts/daily-upload.mjs). Gated by
                // DAILY_ADMIN_KEY (falls back to RESOURCES_ADMIN_KEY).
                "upsert" -> {
                    val adminKey = b.str("adminKey").orEmpty()
                    val expected = System.getenv("DAILY_ADMIN_KEY").orEmpty()
                        .ifEmpty { System.getenv("RESOURCES_ADMIN_KEY").orEmpty() }
                    if (expected.isEmpty() || adminKey != expected) {
                        return@handle call.fail(HttpStatusCode.Forbidden, "Not allowed")
                    }
                    val type = b.str("type").orEmpty()
                    if (type !in TYPES) return@handle call.fail(HttpStatusCode.BadRequest, "type must be term|drill|one-liner")
                    val date = b.str("scheduledDate").orEmpty()
                    if (!DATE_RE.matches(date)) return@handle call.fail(HttpStatusCode.BadRequest, "scheduledDate must be YYYY-MM-DD")
                    val status = b.str("status").orEmpty().ifEmpty { "draft" }
                    val source = b.str("source").orEmpty().trim()
                    val reviewer = b.str("reviewer").orEmpty().trim()
                    val reviewedOn = b.str("reviewedOn").orEmpty().trim()
                    val content = (b["content"] ?: JsonObject(emptyMap())).toString()
                    // Content rule: approved needs source + reviewer + reviewed_on.
                    if (status == "approved" && (source.isEmpty() || reviewer.isEmpty() || reviewedOn.isEmpty())) {
                        return@handle call.fail(HttpStatusCode.BadRequest, "approved needs source + reviewer + reviewedOn")
                    }
                    if (status == "approved" && !reviewedOn.isEmpty() && !DATE_RE.matches(reviewedOn)) {
                        return@handle call.fail(HttpStatusCode.BadRequest, "reviewedOn must be YYYY-MM-DD")
                    }
                    // One-liners must carry a reference list so the screen can
                    // link the user to further reading (real cases only).
                    if (status == "approved" && type == "one-liner") {
                        val err = validateOneLinerContent(b["content"] as? JsonObject)
                        if (err != null) return@handle call.fail(HttpStatusCode.BadRequest, err)
                    }
                    val ext = b.str("externalId").orEmpty().trim().take(120)
                    if (ext.isNotEmpty()) {
                        s.db.exec(
                            "INSERT INTO daily_items (type, scheduled_date, specialty, content, source, reviewer, reviewed_on, status, external_id) " +
                                "VALUES (?, ?::date, ?, ?::jsonb, ?, ?, ?::date, ?, ?) " +
                                "ON CONFLICT (external_id) DO UPDATE SET type = EXCLUDED.type, " +
                                "scheduled_date = EXCLUDED.scheduled_date, specialty = EXCLUDED.specialty, " +
                                "content = EXCLUDED.content, source = EXCLUDED.source, reviewer = EXCLUDED.reviewer, " +
                                "reviewed_on = EXCLUDED.reviewed_on, status = EXCLUDED.status",
                            type, date, b.str("specialty").orEmpty(), content,
                            source, reviewer, reviewedOn.ifEmpty { null }, status, ext,
                        )
                    } else {
                        // legacy one-per-day upsert (term / drill)
                        val existing = s.db.row(
                            "SELECT id FROM daily_items WHERE type = ? AND scheduled_date = ?::date LIMIT 1",
                            type, date,
                        )
                        if (existing != null) {
                            val id = existing["id"]?.jsonPrimitive?.contentOrNull?.toIntOrNull()
                            s.db.exec(
                                "UPDATE daily_items SET specialty = ?, content = ?::jsonb, source = ?, " +
                                    "reviewer = ?, reviewed_on = ?::date, status = ? WHERE id = ?",
                                b.str("specialty").orEmpty(), content, source, reviewer,
                                reviewedOn.ifEmpty { null }, status, id,
                            )
                        } else {
                            s.db.exec(
                                "INSERT INTO daily_items (type, scheduled_date, specialty, content, source, reviewer, reviewed_on, status) " +
                                    "VALUES (?, ?::date, ?, ?::jsonb, ?, ?, ?::date, ?)",
                                type, date, b.str("specialty").orEmpty(), content,
                                source, reviewer, reviewedOn.ifEmpty { null }, status,
                            )
                        }
                    }
                    call.ok(JsonObject(mapOf("ok" to JsonPrimitive(true))))
                }
                "complete" -> {
                    val id = b.int("itemId") ?: return@handle call.fail(HttpStatusCode.BadRequest, "itemId required")
                    markDone(s, uid, id)
                    call.ok(JsonObject(mapOf("ok" to JsonPrimitive(true))))
                }
                "answer_oneliner" -> {
                    val id = b.int("itemId") ?: return@handle call.fail(HttpStatusCode.BadRequest, "itemId required")
                    val entries = (b["entries"] as? JsonArray)?.mapNotNull {
                        it.jsonPrimitive.contentOrNull?.trim()?.takeIf { v -> v.length >= 2 }
                    }?.take(3) ?: emptyList()
                    if (entries.isEmpty()) return@handle call.fail(HttpStatusCode.BadRequest, "at least one entry required")
                    val item = s.db.row(
                        "SELECT content, specialty FROM daily_items WHERE id = ? AND type = 'one-liner' LIMIT 1",
                        id,
                    ) ?: return@handle call.fail(HttpStatusCode.NotFound, "Case not found")
                    val content = parseContent(item["content"])
                    val ranked = rankDifferentials(s, uid, content, entries)
                    s.db.exec(
                        "INSERT INTO daily_answers (user_id, item_id, entries) VALUES (?, ?, ?::jsonb) " +
                            "ON CONFLICT (user_id, item_id) DO UPDATE SET entries = EXCLUDED.entries, answered_at = now()",
                        uid, id, JsonArray(entries.map { JsonPrimitive(it) }).toString(),
                    )
                    markDone(s, uid, id)
                    call.ok(
                        JsonObject(
                            mapOf(
                                "differentials" to JsonArray(ranked),
                                "reason" to (content["reason"] ?: JsonPrimitive("")),
                                "references" to (content["references"] ?: JsonArray(emptyList())),
                            ),
                        ),
                    )
                }
                "save_term" -> {
                    val id = b.int("itemId") ?: return@handle call.fail(HttpStatusCode.BadRequest, "itemId required")
                    val item = s.db.row("SELECT content FROM daily_items WHERE id = ? AND type = 'term'", id)
                        ?: return@handle call.fail(HttpStatusCode.NotFound, "Term not found")
                    val content = item["content"] as? JsonObject ?: JsonObject(emptyMap())
                    val term = (content["term"] as? JsonPrimitive)?.content ?: "Term of the day"
                    val meaning = (content["meaning"] as? JsonPrimitive)?.content ?: ""
                    // ensure a Cards deck exists, then add the term
                    val deck = s.db.execReturning(
                        "INSERT INTO decks (owner_id, name, exam_tag) SELECT ?, 'Cards', '' " +
                            "WHERE NOT EXISTS (SELECT 1 FROM decks WHERE owner_id = ? AND name = 'Cards') " +
                            "RETURNING id, name, exam_tag",
                        uid, uid,
                    ) ?: s.db.row("SELECT id FROM decks WHERE owner_id = ? AND name = 'Cards' LIMIT 1", uid)
                    val deckId = deck?.get("id")?.toString()?.trim('"')?.toIntOrNull()
                    if (deckId != null) {
                        s.db.exec(
                            "INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)",
                            deckId, term, meaning,
                        )
                    }
                    markDone(s, uid, id)
                    call.ok(JsonObject(mapOf("ok" to JsonPrimitive(true))))
                }
                else -> call.fail(HttpStatusCode.BadRequest, "Unknown action")
            }
        }
    }
}

private val TYPES = listOf("term", "drill", "one-liner")
private val DATE_RE = Regex("""^\d{4}-\d{2}-\d{2}$""")

// ── one-liner recommendation engine ─────────────────────────────────────────

/**
 * Content shape (one-liner):
 *   presentation: "58-year-old smoker with 3 weeks of cough, weight loss and Na 124."
 *   differentials: [{ name, confidence 1..5, topics: [..], aliases: [..], note }]
 *   reason: short plain-English explanation
 *   references: [{ title, org, year, url }]   <- required for approved cases
 * Legacy shape (answer / also_consider / diagnoses) is upgraded on the fly.
 */
private fun validateOneLinerContent(content: JsonObject?): String? {
    if (content == null) return "content must be a JSON object"
    val presentation = content.str("presentation").orEmpty().trim()
    if (presentation.isEmpty()) return "one-liner needs presentation"
    val hasDiffs = (content["differentials"] as? JsonArray)?.isNotEmpty() == true
    if (!hasDiffs && content.str("answer").isNullOrEmpty()) return "one-liner needs differentials or answer"
    val refs = content["references"] as? JsonArray
    if (refs.isNullOrEmpty()) return "approved one-liners need at least one reference {title, org, url}"
    if (refs.any { it.jsonObject.str("url").isNullOrEmpty() }) return "every reference needs a url"
    return null
}

private fun parseContent(v: Any?): JsonObject = when (v) {
    is JsonObject -> v
    is JsonPrimitive -> if (v.isString) runCatching {
        kotlinx.serialization.json.Json.parseToJsonElement(v.content).jsonObject
    }.getOrNull() ?: JsonObject(emptyMap()) else JsonObject(emptyMap())
    else -> JsonObject(emptyMap())
}

/** Setup stores exam as "EXAM - Specialty"; return the specialty part. */
private suspend fun userSpecialty(s: Services, uid: Int): String {
    val exam = s.db.row("SELECT exam FROM users WHERE id = ?", uid)
        ?.get("exam")?.jsonPrimitive?.contentOrNull.orEmpty()
    return exam.substringAfter(" - ", "").trim()
}

/** Differentials authored in content, or upgraded from the legacy shape. */
private fun differentialsOf(content: JsonObject): List<JsonObject> {
    (content["differentials"] as? JsonArray)?.let { arr ->
        return arr.mapNotNull { it as? JsonObject }
    }
    val out = ArrayList<JsonObject>()
    val answer = content.str("answer").orEmpty().trim()
    if (answer.isNotEmpty()) {
        out.add(JsonObject(mapOf("name" to JsonPrimitive(answer), "confidence" to JsonPrimitive(5))))
    }
    for (c in (content["also_consider"] as? JsonArray ?: JsonArray(emptyList()))) {
        val name = c.jsonPrimitive.contentOrNull?.trim().orEmpty()
        if (name.isNotEmpty()) out.add(JsonObject(mapOf("name" to JsonPrimitive(name), "confidence" to JsonPrimitive(3))))
    }
    val known = out.map { it.str("name").orEmpty().lowercase() }.toHashSet()
    for (d in (content["diagnoses"] as? JsonArray ?: JsonArray(emptyList()))) {
        val name = d.jsonPrimitive.contentOrNull?.trim().orEmpty()
        if (name.isNotEmpty() && name.lowercase() !in known) {
            out.add(JsonObject(mapOf("name" to JsonPrimitive(name), "confidence" to JsonPrimitive(2))))
        }
    }
    return out
}

private fun norm(s: String): String = s.trim().lowercase().replace(Regex("""\s+"""), " ")

/**
 * Rank the case's differentials for this user: base confidence 1..5 from the
 * content, +1 (capped at 5) when a differential's topics hit a subject the
 * user recently got wrong in the MCQ bank or is actively studying — i.e. the
 * engine nudges weak/relevant areas up so the user meets them again.
 */
private suspend fun rankDifferentials(s: Services, uid: Int, content: JsonObject, entries: List<String>): List<JsonObject> {
    val weakSubjects = runCatching {
        val rows = s.db.rows(
            "SELECT subject, COUNT(*) AS done, SUM(CASE WHEN correct THEN 1 ELSE 0 END) AS ok " +
                "FROM mcq_answers WHERE user_id = ? AND subject <> '' GROUP BY subject",
            uid,
        )
        rows.filter { r ->
            val done = r["done"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: 0
            val ok = r["ok"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: 0
            done >= 3 && ok * 100 / done < 60
        }.map { it["subject"]?.jsonPrimitive?.contentOrNull.orEmpty().lowercase() }
    }.getOrDefault(emptyList())
    val studied = runCatching {
        s.db.rows("SELECT name FROM study_topics WHERE user_id = ?", uid)
            .map { it["name"]?.jsonPrimitive?.contentOrNull.orEmpty().lowercase() }
            .filter { it.isNotEmpty() }
    }.getOrDefault(emptyList())
    val activity = weakSubjects + studied
    val entrySet = entries.map { norm(it) }.toHashSet()

    return differentialsOf(content).map { d ->
        val name = d.str("name").orEmpty().trim()
        val base = (d.int("confidence") ?: 3).coerceIn(1, 5)
        val topics = ((d["topics"] as? JsonArray) ?: JsonArray(emptyList()))
            .mapNotNull { it.jsonPrimitive.contentOrNull?.lowercase() }
        val aliases = ((d["aliases"] as? JsonArray) ?: JsonArray(emptyList()))
            .mapNotNull { it.jsonPrimitive.contentOrNull?.let { a -> norm(a) } }
        val boosted = base < 5 && topics.any { t -> activity.any { a -> a.isNotEmpty() && (t.contains(a) || a.contains(t)) } }
        val conf = if (boosted) base + 1 else base
        val matched = norm(name) in entrySet || aliases.any { it in entrySet }
        JsonObject(
            mapOf(
                "name" to JsonPrimitive(name),
                "confidence" to JsonPrimitive(conf),
                "baseConfidence" to JsonPrimitive(base),
                "boosted" to JsonPrimitive(boosted),
                "label" to JsonPrimitive(if (conf >= 5) "Most likely" else if (conf >= 3) "Consider" else "Less likely"),
                "matched" to JsonPrimitive(matched),
                "note" to (d["note"] ?: JsonPrimitive("")),
            ) + if (d["topics"] != null) mapOf("topics" to d["topics"]!!) else emptyMap(),
        )
    }.sortedWith(compareByDescending<JsonObject> { it.int("confidence") ?: 0 }.thenByDescending { it.bool("matched") ?: false })
}

// ── shared helpers ──────────────────────────────────────────────────────────

private suspend fun markDone(s: Services, uid: Int, id: Int) {
    s.db.exec(
        "INSERT INTO daily_progress (user_id, item_id, done) VALUES (?, ?, TRUE) " +
            "ON CONFLICT (user_id, item_id) DO UPDATE SET done = TRUE, done_at = now()",
        uid, id,
    )
    // completing any card counts toward the streak — reuse the mark_study tick
    runCatching {
        val u = s.db.row("SELECT * FROM users WHERE id = ?", uid)
        if (u != null) {
            val last = u["last_study_day"]?.toString()?.take(10)
            val today = java.time.LocalDate.now().toString()
            if (last != today) {
                val cur = u["current_streak"]?.toString()?.toIntOrNull() ?: 0
                val longest = u["longest_streak"]?.toString()?.toIntOrNull() ?: 0
                s.db.exec(
                    "UPDATE users SET current_streak = ?, longest_streak = ?, last_study_day = now() WHERE id = ?",
                    cur + 1, maxOf(longest, cur + 1), uid,
                )
            }
        }
    }
}

// mockup drill rotation by weekday (to be confirmed): Mon ECG, Tue ABG,
// Wed Dose, Thu Risk score, Fri mixed. Weekends fall back to latest.
private fun drillPreference(date: String): String? = runCatching {
    when (java.time.LocalDate.parse(date).dayOfWeek) {
        java.time.DayOfWeek.MONDAY -> "ecg"
        java.time.DayOfWeek.TUESDAY -> "abg"
        java.time.DayOfWeek.WEDNESDAY -> "dose"
        java.time.DayOfWeek.THURSDAY -> "risk"
        else -> null
    }
}.getOrNull()

private suspend fun cardFor(s: Services, uid: Int, type: String, date: String): JsonObject? {
    // exact-date approved item first, else most recent approved before that date.
    // drills additionally prefer the weekday rotation topic when scheduled.
    val item = if (type == "drill") {
        val want = drillPreference(date)
        s.db.row(
            "SELECT id, type, scheduled_date, specialty, content, source, reviewer, reviewed_on " +
                "FROM daily_items WHERE type = 'drill' AND status = 'approved' AND scheduled_date <= ?::date " +
                "ORDER BY CASE WHEN ? IS NOT NULL AND specialty ILIKE '%' || ? || '%' THEN 0 ELSE 1 END, " +
                "scheduled_date DESC LIMIT 1",
            date, want, want,
        )
    } else {
        s.db.row(
            "SELECT id, type, scheduled_date, specialty, content, source, reviewer, reviewed_on " +
                "FROM daily_items WHERE type = ? AND status = 'approved' AND scheduled_date <= ?::date " +
                "ORDER BY scheduled_date DESC LIMIT 1",
            type, date,
        )
    } ?: return null
    return withDone(s, uid, item)
}

/** Unanswered-first rotation for one-liners, biased to the user's specialty. */
private suspend fun oneLinerCard(s: Services, uid: Int, date: String, specialty: String): JsonObject? {
    val cols = "d.id, d.type, d.scheduled_date, d.specialty, d.content, d.source, d.reviewer, d.reviewed_on"
    val unanswered = s.db.row(
        "SELECT $cols FROM daily_items d " +
            "LEFT JOIN daily_answers a ON a.item_id = d.id AND a.user_id = ? " +
            "WHERE d.type = 'one-liner' AND d.status = 'approved' AND d.scheduled_date <= ?::date " +
            "AND a.item_id IS NULL " +
            "ORDER BY CASE WHEN ? <> '' AND (d.specialty ILIKE '%' || ? || '%' OR ? ILIKE '%' || d.specialty || '%') THEN 0 ELSE 1 END, " +
            "d.scheduled_date ASC, d.id ASC LIMIT 1",
        uid, date, specialty, specialty, specialty,
    )
    if (unanswered != null) return withDone(s, uid, unanswered)
    // pool exhausted: most recent approved case (previous behaviour)
    val latest = s.db.row(
        "SELECT $cols FROM daily_items d " +
            "WHERE d.type = 'one-liner' AND d.status = 'approved' AND d.scheduled_date <= ?::date " +
            "ORDER BY d.scheduled_date DESC, d.id DESC LIMIT 1",
        date,
    ) ?: return null
    return withDone(s, uid, latest)
}

private suspend fun withDone(s: Services, uid: Int, item: JsonObject): JsonObject? {
    val id = item["id"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: return null
    val done = s.db.row(
        "SELECT done FROM daily_progress WHERE user_id = ? AND item_id = ?",
        uid, id,
    )?.get("done")?.jsonPrimitive?.contentOrNull == "true"
    val answered = s.db.row(
        "SELECT entries FROM daily_answers WHERE user_id = ? AND item_id = ?",
        uid, id,
    )?.get("entries")
    return JsonObject(
        item.toMutableMap() + mapOf(
            "done" to JsonPrimitive(done),
            "answeredEntries" to (answered ?: JsonArray(emptyList())),
        ),
    )
}
