import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.4.21"
    kotlin("plugin.serialization") version "2.4.21"
    // Shadow 9.x requires Gradle 9 APIs; 8.3.x is the last line that supports Gradle 8.
    id("com.gradleup.shadow") version "8.3.11"
    application
}

group = "app.medconnect"
version = "1.0.0"

val ktorVersion = "3.6.0"

dependencies {
    implementation("io.ktor:ktor-server-core-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-netty-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation-jvm:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-status-pages-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-call-logging-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-cors-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-default-headers-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-compression-jvm:$ktorVersion")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")

    implementation("com.zaxxer:HikariCP:7.1.0")
    implementation("org.postgresql:postgresql:42.7.14")

    implementation("com.auth0:java-jwt:4.6.1")
    implementation("at.favre.lib:bcrypt:0.10.2")

    implementation("org.flywaydb:flyway-core:13.10.0")
    implementation("org.flywaydb:flyway-database-postgresql:13.10.0")

    // Web Push (VAPID). web-push declares its HTTP client, jose4j and BouncyCastle
    // with `runtime` scope, so they are absent from the compile classpath even
    // though `PushService.sendAsync` returns one of their types. Declared here.
    implementation("nl.martijndwars:web-push:5.1.2")
    implementation("org.apache.httpcomponents:httpasyncclient:4.1.5")
    implementation("org.asynchttpclient:async-http-client:2.12.4")
    implementation("org.bouncycastle:bcprov-jdk18on:1.86")

    implementation("ch.qos.logback:logback-classic:1.5.38")

    testImplementation(kotlin("test"))
    testImplementation("io.ktor:ktor-server-test-host-jvm:$ktorVersion")
    testImplementation("io.ktor:ktor-client-content-negotiation-jvm:$ktorVersion")
    // Runs a real Postgres server in-process, so the route tests exercise the
    // same SQL, types and migrations as production instead of a stub.
    testImplementation("io.zonky.test:embedded-postgres:2.2.2")
    testImplementation("io.zonky.test.postgres:embedded-postgres-binaries-windows-amd64:18.6.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        freeCompilerArgs.add("-Xjsr305=strict")
    }
}

application {
    mainClass.set("app.medconnect.ApplicationKt")
}

/**
 * Single runnable jar.
 *
 * `installDist` produces a start script whose -classpath line exceeds Windows'
 * 8191-character command-line limit for a dependency set this size, and a fat
 * jar is also what the container image wants — one file, no classpath assembly.
 */
tasks.shadowJar {
    archiveBaseName.set("medconnect-server")
    archiveClassifier.set("")
    archiveVersion.set("")
    mergeServiceFiles()
    manifest {
        attributes["Main-Class"] = "app.medconnect.ApplicationKt"
    }
}

tasks.named("build") { dependsOn(tasks.shadowJar) }

/**
 * Starts a throwaway PostgreSQL and prints a DATABASE_URL, so `run` can be used
 * on a machine without Docker. See src/test/kotlin/app/medconnect/devtools.
 */
tasks.register<JavaExec>("devDatabase") {
    group = "application"
    description = "Run a local PostgreSQL (no Docker) and print DATABASE_URL"
    mainClass.set("app.medconnect.devtools.DevDatabase")
    classpath = sourceSets["test"].runtimeClasspath
    standardInput = System.`in`
}

// `run` reads credentials from ../.env.local (vercel env pull) and injects them
// into the forked JVM explicitly, so a stale Gradle daemon environment can
// never leak the wrong DATABASE_URL into a local boot.
tasks.named<JavaExec>("run") {
    val localEnv = file("../.env.local")
    if (localEnv.exists()) {
        localEnv.readLines()
            .filter { it.isNotBlank() && !it.startsWith("#") && it.contains('=') && !it.contains("[SENSITIVE]") }
            .forEach { line ->
                val idx = line.indexOf('=')
                environment(line.substring(0, idx), line.substring(idx + 1).trim().removeSurrounding("\""))
            }
    }
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        showStandardStreams = true
        showExceptions = true
        showCauses = true
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}
