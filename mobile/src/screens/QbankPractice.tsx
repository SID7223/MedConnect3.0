import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Screen from '../components/Screen';
import SegmentedPill from '../components/SegmentedPill';
import { useLocalSearchParams } from 'expo-router';
import { useBackAction } from '../context/Back';
import { useTheme } from '../context/Theme';
import { tick, punch } from '../lib/haptics';
import { recordMcqAnswer, restoreMcqEntry, syncPracticeRow } from '../lib/mcqLog';
import type { McqEntry } from '../lib/mcqLog';
import { examColor } from '../lib/examColors';
import {
  ALL,
  DIFFICULTIES,
  EXAMS,
  META,
  QUESTIONS,
  REGIONS,
  SYSTEMS,
  accuracyColor,
  breakdownByExam,
  filterQuestions,
  optionKeys,
  scoreOf,
  shuffle,
} from '../lib/qbank';
import type { AnswerLog, Difficulty, Exam, Filters, OptionKey, Question } from '../lib/qbank';
import { SERIF } from '../theme/fonts';

// MCQ practice runner over the bundled qbank dataset (156 verified questions,
// USMLE / MRCP / FCPS / NEET). Filter -> answer -> explanation + references -> results.

const STORE_KEY = 'mc_qbank_practice_v2';

type ViewName = 'setup' | 'run' | 'results';

interface SavedSession {
  filters: Filters;
  shuffle: boolean;
  ids: string[];
  index: number;
  log: AnswerLog;
  finished: boolean;
}

const DEFAULT_FILTERS: Filters = {
  exam: ALL,
  region: ALL,
  difficulty: ALL,
  imagesOnly: false,
};

function byId(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export default function QbankPracticeScreen() {
  const params = useLocalSearchParams<{ system?: string; ids?: string; resume?: string }>();
  // Deep links from the MCQs screen: ?system=<subject> presets the filter,
  // ?ids=<a,b,c> (shared questions) starts that set immediately. Lazy
  // initializers (not an effect) so mounting with params never cascades.
  const deepIds = useMemo(() => {
    const idsParam = typeof params.ids === 'string' ? params.ids : '';
    if (!idsParam) return [];
    const wanted = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
    return wanted.map((id) => byId(id)).filter((q): q is Question => !!q).map((q) => (q as Question).id);
  }, [params.ids]);
  const deepSystem = typeof params.system === 'string' && (SYSTEMS as string[]).includes(params.system)
    ? params.system
    : undefined;
  const [view, setView] = useState<ViewName>(deepIds.length ? 'run' : 'setup');
  const [filters, setFilters] = useState<Filters>(
    deepSystem ? { ...DEFAULT_FILTERS, system: deepSystem, region: ALL } : DEFAULT_FILTERS,
  );
  const [shuffleOn, setShuffleOn] = useState(false);
  const [ids, setIds] = useState<string[]>(deepIds);
  const [index, setIndex] = useState(0);
  const [log, setLog] = useState<AnswerLog>({});
  const [saved, setSaved] = useState<SavedSession | null>(null);
  // pre-answer persistent values for this session (undo restores them, so the
  // all-time log always reflects real latest attempts, never inflated)
  const sessionPrev = useRef<Record<string, McqEntry | null>>({});

  useBackAction(view !== 'setup', () => setView('setup'));

  // prime the server base row when landing straight into a deep-linked run
  useEffect(() => {
    if (deepIds.length) syncPracticeRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // restore a session that was in progress when the app was last closed
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const s = JSON.parse(raw) as SavedSession;
        if (!Array.isArray(s.ids) || !s.ids.length) return;
        // drop ids that no longer exist in the dataset
        const live = s.ids.filter((id) => !!byId(id));
        if (!live.length) return;
        // mockup Resume row: ?resume=1 jumps straight back into the saved set
        if (params.resume === '1' && !s.finished && Object.keys(s.log || {}).length < live.length) {
          setFilters(s.filters);
          setShuffleOn(s.shuffle);
          setIds(live);
          setIndex(Math.min(s.index, live.length - 1));
          setLog(s.log || {});
          setView('run');
          syncPracticeRow();
          return;
        }
        setSaved({ ...s, ids: live });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((s: SavedSession) => {
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(s)).catch(() => {});
  }, []);

  const start = (f: Filters, shuffleQuestions: boolean) => {
    const pool = filterQuestions(f);
    const next = shuffleQuestions ? shuffle(pool) : pool;
    setFilters(f);
    setShuffleOn(shuffleQuestions);
    setIds(next.map((q) => q.id));
    setIndex(0);
    setLog({});
    setView('run');
    tick();
    sessionPrev.current = {};
    if (next.length) persist({ filters: f, shuffle: shuffleQuestions, ids: next.map((q) => q.id), index: 0, log: {}, finished: false });
  };

  const resume = () => {
    if (!saved) return;
    setFilters(saved.filters);
    setShuffleOn(saved.shuffle);
    setIds(saved.ids);
    setIndex(Math.min(saved.index, saved.ids.length - 1));
    setLog(saved.log || {});
    setView(saved.finished ? 'results' : 'run');
    sessionPrev.current = {};
  };

  const clearSaved = () => {
    setSaved(null);
    AsyncStorage.removeItem(STORE_KEY).catch(() => {});
  };

  const answer = (letter: OptionKey) => {
    const q = current;
    if (!q || log[q.id]) return;
    const next = { ...log, [q.id]: letter };
    setLog(next);
    if (letter === q.answer) tick();
    else punch();
    persist({ filters, shuffle: shuffleOn, ids, index, log: next, finished: false });
    // ST3 true-count log: distinct questions, latest attempt wins. This write
    // also self-heals any inflated Practice row (old accumulator bug).
    recordMcqAnswer(q.id, q.system, letter === q.answer).then(({ prev }) => {
      sessionPrev.current[q.id] = prev;
    }).catch(() => {});
  };

  const undo = () => {
    const q = current;
    if (!q || !log[q.id]) return;
    const next = { ...log };
    delete next[q.id];
    setLog(next);
    tick();
    persist({ filters, shuffle: shuffleOn, ids, index, log: next, finished: false });
    restoreMcqEntry(q.id, sessionPrev.current[q.id] ?? null).catch(() => {});
    delete sessionPrev.current[q.id];
  };

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(i, ids.length - 1));
    setIndex(clamped);
    tick();
    persist({ filters, shuffle: shuffleOn, ids, index: clamped, log, finished: false });
  };

  const finish = () => {
    setView('results');
    punch();
    persist({ filters, shuffle: shuffleOn, ids, index, log, finished: true });
    // per-answer syncs already wrote true values; re-push for safety (idempotent)
    syncPracticeRow();
  };

  const session = useMemo(() => ids.map((id) => byId(id)).filter((q): q is Question => !!q), [ids]);
  const current = session[index];
  const stats = useMemo(() => scoreOf(session, log), [session, log]);

  return (
    <Screen>
      {view === 'setup' && (
        <SetupView
          filters={filters}
          onFilters={setFilters}
          shuffleOn={shuffleOn}
          onShuffle={setShuffleOn}
          saved={saved}
          onResume={resume}
          onDiscard={clearSaved}
          onStart={start}
        />
      )}
      {view === 'run' && current && (
        <RunView
          question={current}
          index={index}
          total={session.length}
          log={log}
          answeredCount={stats.answered}
          correctCount={stats.correct}
          onAnswer={answer}
          onUndo={undo}
          onPrev={() => goTo(index - 1)}
          onNext={() => goTo(index + 1)}
          onFinish={finish}
          onChangeFilters={() => setView('setup')}
        />
      )}
      {view === 'results' && (
        <ResultsView
          session={session}
          log={log}
          onRestart={() => start(filters, shuffleOn)}
          onChangeFilters={() => setView('setup')}
          onJump={(i) => {
            setIndex(i);
            setView('run');
          }}
        />
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ setup */

function SetupView({
  filters,
  onFilters,
  shuffleOn,
  onShuffle,
  saved,
  onResume,
  onDiscard,
  onStart,
}: {
  filters: Filters;
  onFilters: (f: Filters) => void;
  shuffleOn: boolean;
  onShuffle: (v: boolean) => void;
  saved: SavedSession | null;
  onResume: () => void;
  onDiscard: () => void;
  onStart: (f: Filters, s: boolean) => void;
}) {
  const { colors } = useTheme();
  const pool = useMemo(() => filterQuestions(filters), [filters]);
  const imageCount = pool.filter((q) => q.image).length;

  const hasSavedProgress =
    !!saved && Object.keys(saved.log || {}).length > 0 && !saved.finished;
  const savedStats = saved ? scoreOf(saved.ids.map((id) => byId(id)).filter((q): q is Question => !!q), saved.log || {}) : null;

  return (
    <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={s.scroll}>
      <View style={[s.hero, { backgroundColor: colors.tintGold }]}>
        <Text style={s.heroGlyph} pointerEvents="none">
          🩺
        </Text>
        <Text style={[s.eyebrow, { color: colors.muted }]}>✦ Practice</Text>
        <Text style={[s.h1, { color: colors.ink }]}>MCQ Bank</Text>
        <Text style={[s.heroSub, { color: colors.ink }]}>
          {`${QUESTIONS.length} single-best-answer questions across ${EXAMS.length} exams, each keyed to a verified guideline or paper.`}
        </Text>
      </View>

      <View style={[s.sheet, { backgroundColor: colors.paper }]}>
        {hasSavedProgress && savedStats && (
          <View style={[s.resumeCard, { backgroundColor: colors.card, borderColor: colors.forest }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.resumeTitle, { color: colors.ink }]}>Session in progress</Text>
              <Text style={[s.resumeSub, { color: colors.muted }]}>
                {`${savedStats.answered}/${saved.ids.length} answered · ${savedStats.accuracy}% accuracy`}
              </Text>
            </View>
            <Pressable onPress={onResume} style={[s.btnSm, { backgroundColor: colors.forest }]}>
              <Text style={[s.btnSmText, { color: colors.paper }]}>Resume</Text>
            </Pressable>
            <Pressable onPress={onDiscard} style={s.resumeX} accessibilityLabel="Discard saved session">
              <Text style={[s.resumeXText, { color: colors.subtle }]}>×</Text>
            </Pressable>
          </View>
        )}

        <Text style={[s.label, { color: colors.muted }]}>Exam</Text>
        <SegmentedPill
          options={[
            { key: ALL, label: 'All' },
            ...EXAMS.map((e) => ({ key: e as string, label: e })),
          ]}
          value={filters.exam}
          onChange={(k) => onFilters({ ...filters, exam: k as Exam | typeof ALL })}
          style={s.segWrap}
        />

        <Text style={[s.label, { color: colors.muted }]}>Difficulty</Text>
        <SegmentedPill
          options={[
            { key: ALL, label: 'All' },
            ...DIFFICULTIES.map((d) => ({ key: d as string, label: cap(d) })),
          ]}
          value={filters.difficulty}
          onChange={(k) => onFilters({ ...filters, difficulty: k as Difficulty | typeof ALL })}
          style={s.segWrap}
        />

        <Text style={[s.label, { color: colors.muted }]}>Region</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {REGIONS.map((r) => (
            <Chip
              key={r}
              label={r}
              active={filters.region === r}
              onPress={() => onFilters({ ...filters, region: filters.region === r ? ALL : r })}
            />
          ))}
        </ScrollView>

        <Text style={[s.label, { color: colors.muted }]}>System</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          <Chip
            label="All"
            active={filters.region === ALL && !filters.system}
            onPress={() => onFilters({ ...filters, region: ALL, system: undefined })}
          />
          {SYSTEMS.map((r) => (
            <Chip
              key={r}
              label={r}
              active={filters.system === r}
              onPress={() =>
                onFilters({ ...filters, system: filters.system === r ? undefined : r, region: ALL })
              }
            />
          ))}
        </ScrollView>

        <View style={s.toggleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.toggleTitle, { color: colors.ink }]}>Image questions only</Text>
            <Text style={[s.toggleSub, { color: colors.muted }]}>Filter to the questions with a figure</Text>
          </View>
          <SwitchPill
            on={filters.imagesOnly}
            onChange={(v) => onFilters({ ...filters, imagesOnly: v })}
            color={colors.forest}
          />
        </View>

        <View style={s.toggleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.toggleTitle, { color: colors.ink }]}>Shuffle</Text>
            <Text style={[s.toggleSub, { color: colors.muted }]}>Randomise the order of this session</Text>
          </View>
          <SwitchPill on={shuffleOn} onChange={onShuffle} color={colors.forest} />
        </View>

        <View style={[s.summary, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Text style={[s.summaryBig, { color: pool.length ? colors.forest : colors.rust }]}>
            {String(pool.length)}
          </Text>
          <Text style={[s.summaryLabel, { color: colors.muted }]}>
            {pool.length ? `questions · ${imageCount} with images` : 'questions match these filters'}
          </Text>
        </View>

        <Pressable
          disabled={!pool.length}
          onPress={() => onStart(filters, shuffleOn)}
          style={({ pressed }) => [
            s.startBtn,
            {
              backgroundColor: pool.length ? colors.forest : colors.subtle,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[s.startBtnText, { color: colors.paper }]}>
            {pool.length ? `Start ${pool.length} questions` : 'No questions match'}
          </Text>
        </Pressable>

        <Text style={[s.footnote, { color: colors.subtle }]}>{META.note}</Text>
        <Text style={[s.footnote, { color: colors.subtle }]}>
          {`Content currency: ${META.data_currency}. For study and teaching only - not clinical decision support.`}
        </Text>
      </View>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------- run */

function RunView({
  question,
  index,
  total,
  log,
  answeredCount,
  correctCount,
  onAnswer,
  onUndo,
  onPrev,
  onNext,
  onFinish,
  onChangeFilters,
}: {
  question: Question;
  index: number;
  total: number;
  log: AnswerLog;
  answeredCount: number;
  correctCount: number;
  onAnswer: (l: OptionKey) => void;
  onUndo: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  onChangeFilters: () => void;
}) {
  const { colors } = useTheme();
  const given = log[question.id];
  const answered = !!given;
  const correct = given === question.answer;
  const keys = optionKeys(question);
  const accent = examColor(question.exams[0]);
  const progress = total ? ((index + 1) / total) * 100 : 0;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  return (
    <View style={s.flex}>
      <View style={[s.runHead, { backgroundColor: colors.paper, borderBottomColor: colors.line }]}>
        <View style={s.runHeadRow}>
          <Pressable onPress={onChangeFilters} style={s.headBtn} accessibilityLabel="Back to filters">
            <Text style={[s.headBtnText, { color: colors.muted }]}>Filters</Text>
          </Pressable>
          <Text style={[s.runCount, { color: colors.ink }]}>
            {`${index + 1} / ${total}`}
          </Text>
          <Pressable onPress={onFinish} style={s.headBtn} accessibilityLabel="Finish session">
            <Text style={[s.headBtnText, { color: colors.forest }]}>Finish</Text>
          </Pressable>
        </View>
        <View style={[s.progressTrack, { backgroundColor: colors.paper2 }]}>
          <View style={[s.progressFill, { width: `${progress}%`, backgroundColor: accent }]} />
        </View>
        <Text style={[s.runSub, { color: colors.muted }]}>
          {`${answeredCount} answered · ${correctCount} correct${
            answeredCount ? ` · ${Math.round((correctCount / answeredCount) * 100)}%` : ''
          }`}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={s.runScroll}
      >
        <View style={[s.metaCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <View style={s.tagRow}>
            {question.exams.map((e) => (
              <View key={e} style={[s.tag, { borderColor: examColor(e) }]}>
                <Text style={[s.tagText, { color: examColor(e) }]}>{e}</Text>
              </View>
            ))}
            <View style={[s.tag, { borderColor: colors.line }]}>
              <Text style={[s.tagText, { color: colors.muted }]}>{cap(question.difficulty)}</Text>
            </View>
          </View>
          <Text style={[s.metaSystem, { color: colors.ink }]}>
            {`${question.system} · ${question.topic}`}
          </Text>
          <Text style={[s.metaRegion, { color: colors.subtle }]}>{question.region}</Text>
        </View>

        <Text style={[s.stem, { color: colors.ink }]}>{question.stem}</Text>

        {question.image && <Figure q={question} />}

        <View style={s.optionWrap}>
          {keys.map((k) => {
            const isGiven = given === k;
            const isKey = question.answer === k;
            const border = answered && isKey ? colors.green : answered && isGiven ? colors.rust : colors.line;
            const bg = answered && isKey ? 'rgba(44,106,85,0.10)' : answered && isGiven ? 'rgba(168,68,42,0.10)' : colors.card;
            return (
              <Pressable
                key={k}
                onPress={() => onAnswer(k)}
                disabled={answered}
                accessibilityRole="button"
                accessibilityState={{ disabled: answered, selected: isGiven }}
                style={({ pressed }) => [
                  s.option,
                  { backgroundColor: bg, borderColor: border },
                  pressed && !answered && { opacity: 0.8 },
                ]}
              >
                <View
                  style={[
                    s.optionKey,
                    {
                      backgroundColor: answered && isKey ? colors.green : answered && isGiven ? colors.rust : accent,
                    },
                  ]}
                >
                  <Text style={[s.optionKeyText, { color: colors.onForest }]}>{k}</Text>
                </View>
                <Text style={[s.optionText, { color: colors.ink }]}>{question.options[k]}</Text>
                {answered && isKey && <Text style={[s.markCorrect, { color: colors.green }]}>✓</Text>}
                {answered && isGiven && !isKey && <Text style={[s.markWrong, { color: colors.rust }]}>✕</Text>}
              </Pressable>
            );
          })}
        </View>

        {answered && (
          <View style={[s.feedback, { backgroundColor: colors.card, borderColor: correct ? colors.green : colors.rust }]}>
            <View style={s.feedbackHead}>
              <Text style={[s.feedbackVerdict, { color: correct ? colors.green : colors.rust }]}>
                {correct ? '✓ Correct' : `✕ Incorrect - answer ${question.answer}`}
              </Text>
              <Pressable onPress={onUndo} style={s.undoBtn} accessibilityLabel="Clear answer">
                <Text style={[s.undoText, { color: colors.muted }]}>Undo</Text>
              </Pressable>
            </View>
            <Text style={[s.explanation, { color: colors.ink }]}>{question.explanation}</Text>

            <Text style={[s.refsTitle, { color: colors.muted }]}>
              {`References · updated ${question.updated}`}
            </Text>
            {question.references.map((r) => (
              <Pressable
                key={r.url}
                onPress={() => Linking.openURL(r.url).catch(() => {})}
                style={[s.refRow, { borderTopColor: colors.line }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.refTitle, { color: colors.ink }]}>{r.title}</Text>
                  <Text style={[s.refMeta, { color: colors.subtle }]}>
                    {[r.org, r.year].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={[s.refGo, { color: colors.forest }]}>↗</Text>
              </Pressable>
            ))}
            {question.image && (
              <Text style={[s.attrib, { color: colors.subtle }]}>Figure: {question.image.source}</Text>
            )}
          </View>
        )}

        <View style={s.navRow}>
          <Pressable
            onPress={onPrev}
            disabled={index === 0}
            style={[s.navBtn, s.navGhost, { borderColor: colors.forest, opacity: index === 0 ? 0.4 : 1 }]}
          >
            <Text style={[s.navText, { color: colors.forest }]}>← Previous</Text>
          </Pressable>
          {index < total - 1 ? (
            <Pressable
              onPress={onNext}
              style={[s.navBtn, s.flex, { backgroundColor: colors.forest }]}
            >
              <Text style={[s.navText, { color: colors.paper }]}>Next →</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onFinish} style={[s.navBtn, s.flex, { backgroundColor: colors.forest }]}>
              <Text style={[s.navText, { color: colors.paper }]}>See results</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Figure({ q }: { q: Question }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const img = q.image!;
  return (
    <Pressable
      onPress={() => { if (failed) { setFailed(false); setLoading(true); setRetry((r) => r + 1); } }}
      style={[s.figureWrap, { backgroundColor: colors.card, borderColor: colors.line }]}
    >
      {failed ? (
        <Text style={[s.figureFail, { color: colors.muted }]}>
          {`Figure could not be loaded.\n${img.alt}\nTap to retry.`}
        </Text>
      ) : (
        <>
          <Image
            key={retry}
            source={{ uri: img.url }}
            style={s.figureImg}
            resizeMode="contain"
            accessibilityLabel={img.alt}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setFailed(true); }}
          />
          {loading && (
            <ActivityIndicator
              size="small"
              color={colors.muted}
              style={{ position: 'absolute', alignSelf: 'center', top: 60 }}
            />
          )}
        </>
      )}
      <Text style={[s.figureCaption, { color: colors.muted }]}>{img.caption}</Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- results */

function ResultsView({
  session,
  log,
  onRestart,
  onChangeFilters,
  onJump,
}: {
  session: Question[];
  log: AnswerLog;
  onRestart: () => void;
  onChangeFilters: () => void;
  onJump: (index: number) => void;
}) {
  const { colors } = useTheme();
  const stats = useMemo(() => scoreOf(session, log), [session, log]);
  const perExam = useMemo(() => breakdownByExam(session, log), [session, log]);
  const missed = useMemo(
    () => session.filter((q) => log[q.id] && log[q.id] !== q.answer),
    [session, log],
  );
  const unattempted = session.filter((q) => !log[q.id]).length;

  return (
    <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={s.scroll}>
      <View style={[s.hero, { backgroundColor: colors.tintGold }]}>
        <Text style={s.heroGlyph} pointerEvents="none">
          🎯
        </Text>
        <Text style={[s.eyebrow, { color: colors.muted }]}>✦ Session complete</Text>
        <Text style={[s.h1, { color: colors.ink }]}>Results</Text>
        <Text style={[s.heroSub, { color: colors.ink }]}>{`${stats.correct} correct of ${stats.answered} answered`}</Text>
      </View>

      <View style={[s.sheet, { backgroundColor: colors.paper }]}>
        <View style={[s.scoreCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Text style={[s.scoreBig, { color: accuracyColor(stats.accuracy, colors) }]}>{`${stats.accuracy}%`}</Text>
          <Text style={[s.scoreLabel, { color: colors.muted }]}>accuracy this session</Text>
          <View style={[s.scoreBarTrack, { backgroundColor: colors.paper2 }]}>
            <View
              style={[
                s.scoreBarFill,
                { width: `${stats.accuracy}%`, backgroundColor: accuracyColor(stats.accuracy, colors) },
              ]}
            />
          </View>
          <Text style={[s.scoreNote, { color: colors.subtle }]}>
            {missed.length
              ? `${missed.length} to review${unattempted ? ` · ${unattempted} not attempted` : ''}`
              : unattempted
                ? `${unattempted} not attempted`
                : 'Perfect run - nothing to review.'}
          </Text>
        </View>

        {perExam.length > 1 && (
          <>
            <Text style={[s.label, { color: colors.muted }]}>By exam</Text>
            <View style={[s.breakCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
              {perExam.map((r) => (
                <View key={r.exam} style={[s.breakRow, { borderTopColor: colors.line }]}>
                  <View style={[s.breakDot, { backgroundColor: examColor(r.exam) }]} />
                  <Text style={[s.breakExam, { color: colors.ink }]}>{r.exam}</Text>
                  <Text style={[s.breakCount, { color: colors.muted }]}>
                    {`${r.correct}/${r.answered}`}
                  </Text>
                  <Text style={[s.breakPct, { color: accuracyColor(r.accuracy, colors) }]}>{`${r.accuracy}%`}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {missed.length > 0 && (
          <>
            <Text style={[s.label, { color: colors.muted }]}>Review these</Text>
            {missed.map((q) => {
              const i = session.findIndex((x) => x.id === q.id);
              return (
                <Pressable
                  key={q.id}
                  onPress={() => onJump(i)}
                  style={[s.missCard, { backgroundColor: colors.card, borderColor: colors.line }]}
                >
                  <Text style={[s.missSystem, { color: colors.subtle }]}>
                    {`${q.system} · ${q.topic}`}
                  </Text>
                  <Text style={[s.missStem, { color: colors.ink }]} numberOfLines={3}>
                    {q.stem}
                  </Text>
                  <Text style={[s.missMeta, { color: colors.muted }]}>
                    {`You chose ${log[q.id]} · answer ${q.answer} ›`}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}

        <View style={s.navRow}>
          <Pressable
            onPress={onChangeFilters}
            style={[s.navBtn, s.navGhost, s.flex, { borderColor: colors.forest }]}
          >
            <Text style={[s.navText, { color: colors.forest }]}>Change filters</Text>
          </Pressable>
          <Pressable onPress={onRestart} style={[s.navBtn, s.flex, { backgroundColor: colors.forest }]}>
            <Text style={[s.navText, { color: colors.paper }]}>New session</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

/* --------------------------------------------------------------- fragments */

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      style={[
        s.chip,
        active
          ? { backgroundColor: colors.forest, borderColor: colors.forest }
          : { backgroundColor: colors.card, borderColor: colors.line },
      ]}
    >
      <Text style={[s.chipText, { color: active ? colors.paper : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

function SwitchPill({
  on,
  onChange,
  color,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  color: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        tick();
        onChange(!on);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={{ flexShrink: 0 }}
    >
      <View
        style={[
          s.track,
          { width: 46, height: 27, backgroundColor: on ? color : colors.subtle },
        ]}
      >
        <View
          style={[
            s.knob,
            { top: 3, left: on ? 25 : 3, backgroundColor: colors.onForest },
          ]}
        />
      </View>
    </Pressable>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 32 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    minHeight: 150,
    overflow: 'hidden',
  },
  heroGlyph: { position: 'absolute', right: -8, bottom: -16, fontSize: 88, opacity: 0.1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  h1: { letterSpacing: -0.4, fontFamily: SERIF, fontSize: 24, lineHeight: 25 },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 21 },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  segWrap: { marginBottom: 2 },
  chipRow: { gap: 8, paddingBottom: 2, alignItems: 'center' },
  chip: { flexShrink: 0, paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1.5 },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  toggleTitle: { fontWeight: '700', fontSize: 14 },
  toggleSub: { fontSize: 11.5, marginTop: 1 },
  track: { borderRadius: 999, justifyContent: 'center' },
  knob: { position: 'absolute', width: 21, height: 21, borderRadius: 11 },
  summary: {
    marginTop: 20,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  summaryBig: { fontFamily: SERIF, fontSize: 34, lineHeight: 38 },
  summaryLabel: { fontSize: 12, marginTop: 2, textAlign: 'center' },
  startBtn: { marginTop: 14, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  startBtnText: { fontSize: 16, fontWeight: '700' },
  footnote: { fontSize: 11, lineHeight: 16, marginTop: 12, textAlign: 'center' },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 13,
  },
  resumeTitle: { fontWeight: '700', fontSize: 14 },
  resumeSub: { fontSize: 11.5, marginTop: 1 },
  resumeX: { paddingHorizontal: 4 },
  resumeXText: { fontSize: 20, lineHeight: 22 },
  btnSm: { borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15, alignItems: 'center' },
  btnSmText: { fontSize: 13, fontWeight: '700' },
  runHead: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1 },
  runHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headBtn: { paddingVertical: 4, paddingHorizontal: 6, minWidth: 62 },
  headBtnText: { fontSize: 13, fontWeight: '700' },
  runCount: { fontFamily: SERIF, fontSize: 16 },
  progressTrack: { height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', borderRadius: 999 },
  runSub: { fontSize: 11.5, marginTop: 7 },
  runScroll: { padding: 16, paddingBottom: 28 },
  metaCard: { borderWidth: 1.5, borderRadius: 14, padding: 12, marginBottom: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 7 },
  tag: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 10.5, fontWeight: '800' },
  metaSystem: { fontSize: 13.5, fontWeight: '700' },
  metaRegion: { fontSize: 11.5, marginTop: 2 },
  stem: { fontSize: 15.5, lineHeight: 24, marginBottom: 14 },
  figureWrap: { borderWidth: 1.5, borderRadius: 14, padding: 10, marginBottom: 14 },
  figureImg: { width: '100%', height: 190, backgroundColor: 'transparent' },
  figureFail: { fontSize: 12.5, lineHeight: 18, paddingVertical: 18, textAlign: 'center' },
  figureCaption: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  optionWrap: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
  },
  optionKey: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optionKeyText: { fontSize: 13, fontWeight: '800' },
  optionText: { flex: 1, fontSize: 14, lineHeight: 20, paddingTop: 3 },
  markCorrect: { fontSize: 15, fontWeight: '800', paddingTop: 3 },
  markWrong: { fontSize: 15, fontWeight: '800', paddingTop: 3 },
  feedback: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginTop: 14 },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  feedbackVerdict: { fontSize: 13.5, fontWeight: '800', flex: 1 },
  undoBtn: { paddingVertical: 2, paddingHorizontal: 6 },
  undoText: { fontSize: 12, fontWeight: '700' },
  explanation: { fontSize: 14, lineHeight: 22, marginTop: 9 },
  refsTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
  },
  refTitle: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  refMeta: { fontSize: 11, marginTop: 2 },
  refGo: { fontSize: 15, fontWeight: '700' },
  attrib: { fontSize: 10.5, lineHeight: 15, marginTop: 12 },
  navRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  navBtn: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  navGhost: { backgroundColor: 'transparent', borderWidth: 1.5, paddingHorizontal: 16 },
  navText: { fontSize: 14.5, fontWeight: '700' },
  scoreCard: { borderWidth: 1.5, borderRadius: 18, padding: 18, alignItems: 'center' },
  scoreBig: { fontFamily: SERIF, fontSize: 44, lineHeight: 48 },
  scoreLabel: { fontSize: 12.5, marginTop: 2 },
  scoreBarTrack: { width: '100%', height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 14 },
  scoreBarFill: { height: '100%', borderRadius: 999 },
  scoreNote: { fontSize: 11.5, marginTop: 10, textAlign: 'center' },
  breakCard: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, borderTopWidth: 1 },
  breakDot: { width: 10, height: 10, borderRadius: 3 },
  breakExam: { flex: 1, fontSize: 13, fontWeight: '700' },
  breakCount: { fontSize: 12 },
  breakPct: { fontSize: 13, fontWeight: '800', width: 46, textAlign: 'right' },
  missCard: { borderWidth: 1.5, borderRadius: 14, padding: 13, marginBottom: 8 },
  missSystem: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  missStem: { fontSize: 13.5, lineHeight: 19, marginTop: 5 },
  missMeta: { fontSize: 11.5, marginTop: 7, fontWeight: '700' },
});
