-- V8 — Server-editable remote config (ST9 Resources tile).
--
-- Single key/value store the team edits without an app update. The Resources
-- screen reads key 'resources' (a JSON array of { name, url, desc, icon,
-- section }); unknown keys are ignored by the client. Seeded with the
-- current bundled list so /api/resources works before the team edits it.

CREATE TABLE IF NOT EXISTS remote_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO remote_config (key, value) VALUES ('resources', '[
  {"section":"Clinical references","name":"Drugs.com","icon":"💊","url":"https://www.drugs.com/","desc":"Drug doses, interactions & prescribing info, free and global."},
  {"section":"Clinical references","name":"NICE Guidelines","icon":"📋","url":"https://www.nice.org.uk/guidance","desc":"UK clinical guidelines and pathways for almost every condition."},
  {"section":"Clinical references","name":"MDCalc","icon":"🩺","url":"https://www.mdcalc.com/","desc":"Medical calculators: CHA2DS2-VASc, Wells, GCS, eGFR, hundreds more."},
  {"section":"Exam prep & revision","name":"Geeky Medics","icon":"🎓","url":"https://geekymedics.com/","desc":"OSCE guides with videos for history-taking and examinations."},
  {"section":"Exam prep & revision","name":"Radiopaedia","icon":"📖","url":"https://radiopaedia.org/","desc":"Radiology cases, images, and quizzes by specialty."}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;
