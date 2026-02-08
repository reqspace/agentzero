import type Database from 'better-sqlite3'

export function seedDatabase(db: Database.Database) {
  // Settings
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  )
  const settings: [string, string][] = [
    ['primary_model', 'claude-sonnet-4-5'],
    ['fallback_model', 'gpt-4o'],
    ['anthropic_key', ''],
    ['openai_key', ''],
    ['deepseek_key', ''],
    ['google_key', ''],
    ['replicate_key', ''],
    ['groq_key', ''],
    ['together_key', ''],
    ['daily_cost_limit', '25.00'],
    ['overnight_enabled', 'true'],
    ['sleep_start', '23:00'],
    ['sleep_end', '07:00'],
    ['wake_on_urgent', 'true'],
    ['max_overnight_spend', '10.00'],
    ['gateway_address', 'ws://127.0.0.1:18789'],
    ['lane_mode', 'serial'],
    ['sandbox_mode', 'true'],
    ['require_confirmation', 'true'],
    ['push_enabled', 'true'],
    ['whatsapp_alerts', 'true'],
    ['telegram_alerts', 'true'],
    ['email_digest', 'false'],
    ['today_spend', '4.73'],
  ]
  for (const [key, value] of settings) insertSetting.run(key, value)

  // Channels
  const insertChannel = db.prepare(
    'INSERT OR IGNORE INTO channels (id, name, type, color, enabled, status, unread_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const channels: [string, string, string, string, number, string, number][] = [
    ['whatsapp', 'WhatsApp', 'whatsapp', '#25d366', 1, 'connected', 3],
    ['telegram', 'Telegram', 'telegram', '#0088cc', 1, 'connected', 1],
    ['slack', 'Slack', 'slack', '#e8a820', 1, 'connected', 0],
    ['signal', 'Signal', 'signal', '#3b76f0', 1, 'connected', 2],
    ['discord', 'Discord', 'discord', '#5865f2', 0, 'disconnected', 0],
    ['webchat', 'WebChat', 'webchat', '#ff6b35', 1, 'connected', 0],
  ]
  for (const c of channels) insertChannel.run(...c)

  // Channel messages
  const insertCM = db.prepare(
    'INSERT INTO channel_messages (id, channel_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  )
  const channelMsgs: [string, string, string, string, string][] = [
    ['cm01', 'whatsapp', 'user', 'Hey, can you check the competitor pricing data?', '2026-02-07 08:15:00'],
    ['cm02', 'whatsapp', 'agent', 'Sure! I\'ll scrape the latest prices from all 5 competitors. This usually takes about 10 minutes.', '2026-02-07 08:15:30'],
    ['cm03', 'whatsapp', 'user', 'Great, also compare with our current prices', '2026-02-07 08:16:00'],
    ['cm04', 'whatsapp', 'agent', 'Done! I found 12 products where competitors are priced lower. Sending the full report now.', '2026-02-07 08:25:00'],
    ['cm05', 'whatsapp', 'user', 'Perfect, flag the ones with >10% difference', '2026-02-07 08:26:00'],
    ['cm06', 'telegram', 'agent', 'Overnight batch completed successfully. 847 records processed, 3 errors logged.', '2026-02-07 07:00:00'],
    ['cm07', 'telegram', 'user', 'What were the errors?', '2026-02-07 09:30:00'],
    ['cm08', 'telegram', 'agent', 'All 3 were timeout errors on the payment gateway API. I\'ll retry those automatically in 30 minutes.', '2026-02-07 09:30:15'],
    ['cm09', 'telegram', 'user', 'Ok sounds good. Also schedule the weekly report for Friday', '2026-02-07 09:31:00'],
    ['cm10', 'slack', 'user', 'Deploy the staging build please', '2026-02-07 10:00:00'],
    ['cm11', 'slack', 'agent', 'Starting deployment to staging environment. I\'ll run the test suite first.', '2026-02-07 10:00:15'],
    ['cm12', 'slack', 'agent', 'All 142 tests passed. Deploying to staging now...', '2026-02-07 10:05:00'],
    ['cm13', 'slack', 'agent', 'Staging deployment complete. URL: https://staging.example.com', '2026-02-07 10:08:00'],
    ['cm14', 'signal', 'agent', 'ALERT: Daily spend has reached 80% of limit ($20.00 / $25.00)', '2026-02-07 14:00:00'],
    ['cm15', 'signal', 'user', 'Acknowledged. Increase limit to $35 for today', '2026-02-07 14:05:00'],
    ['cm16', 'signal', 'agent', 'Daily limit updated to $35.00. Current spend: $20.00. Resuming tasks.', '2026-02-07 14:05:10'],
    ['cm17', 'signal', 'user', 'Also pause the image generation tasks, they are expensive', '2026-02-07 14:06:00'],
  ]
  for (const m of channelMsgs) insertCM.run(...m)

  // Tasks
  const insertTask = db.prepare(
    'INSERT INTO tasks (id, title, description, status, priority, skill, progress, tags, column_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const tasks: [string, string, string, string, string, string | null, number, string, number][] = [
    ['t01', 'Scrape competitor pricing data', 'Collect pricing data from 5 competitor websites and generate comparison report', 'done', 'high', 'web-scraper', 100, '["scraping","pricing"]', 0],
    ['t02', 'Generate weekly analytics report', 'Compile data from all sources into a comprehensive weekly report with charts', 'running', 'high', 'report-gen', 65, '["analytics","reports"]', 0],
    ['t03', 'Triage incoming support emails', 'Classify and route incoming support emails by priority and category', 'running', 'med', 'email-triage', 40, '["email","support"]', 1],
    ['t04', 'Update product descriptions', 'Rewrite 50 product descriptions for SEO optimization', 'review', 'med', 'content-writer', 100, '["content","seo"]', 0],
    ['t05', 'Monitor API uptime', 'Continuous monitoring of 12 API endpoints with alerting', 'running', 'low', 'api-monitor', 88, '["monitoring","devops"]', 2],
    ['t06', 'Backup database to S3', 'Full database backup with encryption and upload to S3', 'done', 'high', 'backup-agent', 100, '["backup","infrastructure"]', 1],
    ['t07', 'Train sentiment classifier', 'Fine-tune sentiment analysis model on new customer feedback dataset', 'backlog', 'med', 'ml-trainer', 0, '["ml","nlp"]', 0],
    ['t08', 'Deploy staging environment', 'Build and deploy latest changes to staging with full test suite', 'review', 'high', 'deployer', 100, '["devops","deployment"]', 1],
    ['t09', 'Process overnight invoices', 'Parse and reconcile 200+ invoices from overnight batch', 'backlog', 'low', 'invoice-proc', 0, '["finance","automation"]', 1],
  ]
  for (const t of tasks) insertTask.run(...t)

  // Skills
  const insertSkill = db.prepare(
    'INSERT OR IGNORE INTO skills (id, name, icon, description, version, category, active) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const skills: [string, string, string, string, string, string, number][] = [
    ['web-scraper', 'Web Scraper', '\u{1F578}\uFE0F', 'Extract structured data from any website with intelligent parsing and anti-bot evasion', '2.4.1', 'core', 1],
    ['report-gen', 'Report Generator', '\u{1F4CA}', 'Generate comprehensive reports with charts, tables, and executive summaries', '1.8.0', 'core', 1],
    ['email-triage', 'Email Triage', '\u{1F4E7}', 'Classify, prioritize, and route emails using NLP-based intent detection', '3.1.2', 'comms', 1],
    ['content-writer', 'Content Writer', '\u{270D}\uFE0F', 'Generate SEO-optimized content for blogs, product descriptions, and social media', '2.0.5', 'core', 1],
    ['api-monitor', 'API Monitor', '\u{1F4E1}', 'Real-time monitoring of API endpoints with latency tracking and alerting', '1.5.3', 'dev', 1],
    ['backup-agent', 'Backup Agent', '\u{1F4BE}', 'Automated encrypted backups to S3, GCS, or local storage with versioning', '1.2.0', 'storage', 1],
    ['ml-trainer', 'ML Trainer', '\u{1F9E0}', 'Fine-tune and deploy ML models with automatic hyperparameter optimization', '0.9.1', 'dev', 1],
    ['deployer', 'Deployer', '\u{1F680}', 'Zero-downtime deployments to any cloud platform with rollback support', '2.1.0', 'dev', 1],
    ['invoice-proc', 'Invoice Processor', '\u{1F9FE}', 'Parse invoices using OCR, extract line items, and reconcile with accounting', '1.3.4', 'finance', 1],
    ['slack-bot', 'Slack Bot', '\u{1F4AC}', 'Interactive Slack bot with command handling and thread management', '2.5.0', 'comms', 1],
    ['image-gen', 'Image Generator', '\u{1F3A8}', 'Generate images using DALL-E, Midjourney, or Stable Diffusion APIs', '1.1.0', 'core', 0],
    ['code-review', 'Code Reviewer', '\u{1F50D}', 'Automated code review with security scanning and best practice enforcement', '0.7.2', 'dev', 0],
  ]
  for (const s of skills) insertSkill.run(...s)

  // Logs
  const insertLog = db.prepare(
    'INSERT INTO logs (timestamp, level, message, source) VALUES (?, ?, ?, ?)'
  )
  const logs: [string, string, string, string][] = [
    ['2026-02-07 06:00:00', 'INFO', 'Agent Zero starting up...', 'system'],
    ['2026-02-07 06:00:01', 'INFO', 'Loading configuration from gateway ws://127.0.0.1:18789', 'config'],
    ['2026-02-07 06:00:02', 'INFO', 'Connected to OpenClaw gateway v0.8.3', 'gateway'],
    ['2026-02-07 06:00:03', 'INFO', '12 skills loaded, 10 active', 'skills'],
    ['2026-02-07 06:00:04', 'INFO', 'SQLite database initialized (WAL mode)', 'database'],
    ['2026-02-07 06:00:05', 'INFO', 'WebSocket server listening on port 18789', 'server'],
    ['2026-02-07 06:01:00', 'INFO', 'Starting overnight batch processing', 'scheduler'],
    ['2026-02-07 06:01:15', 'INFO', 'Task [t06] Backup database to S3 - started', 'task-runner'],
    ['2026-02-07 06:05:30', 'INFO', 'Task [t06] Backup complete - 2.4GB uploaded to s3://backups/', 'task-runner'],
    ['2026-02-07 06:10:00', 'INFO', 'Task [t01] Scrape competitor pricing - started', 'task-runner'],
    ['2026-02-07 06:12:00', 'WARN', 'Rate limit approaching on competitor-3.com (42/50 requests)', 'web-scraper'],
    ['2026-02-07 06:15:00', 'INFO', 'Task [t01] Scraping complete - 847 products collected', 'task-runner'],
    ['2026-02-07 06:15:01', 'INFO', 'Price comparison report generated: 12 items below market', 'report-gen'],
    ['2026-02-07 07:00:00', 'INFO', 'Overnight batch completed. 847 records, 3 errors', 'scheduler'],
    ['2026-02-07 07:00:01', 'ERROR', 'Payment gateway timeout after 30s - invoice #INV-2847', 'invoice-proc'],
    ['2026-02-07 07:00:02', 'ERROR', 'Payment gateway timeout after 30s - invoice #INV-2848', 'invoice-proc'],
    ['2026-02-07 07:00:03', 'ERROR', 'Payment gateway timeout after 30s - invoice #INV-2849', 'invoice-proc'],
    ['2026-02-07 08:00:00', 'INFO', 'Task [t02] Weekly report generation started', 'task-runner'],
    ['2026-02-07 08:30:00', 'INFO', 'Task [t03] Email triage started - 156 emails in queue', 'task-runner'],
    ['2026-02-07 09:00:00', 'DEBUG', 'Heartbeat: CPU 12%, MEM 340MB, uptime 3h', 'monitor'],
    ['2026-02-07 10:00:00', 'INFO', 'Task [t08] Staging deployment initiated by user', 'deployer'],
    ['2026-02-07 10:05:00', 'INFO', 'Test suite passed: 142/142 tests green', 'deployer'],
    ['2026-02-07 10:08:00', 'INFO', 'Staging deployment complete', 'deployer'],
    ['2026-02-07 14:00:00', 'WARN', 'Daily spend at 80%: $20.00 / $25.00', 'cost-tracker'],
    ['2026-02-07 14:05:10', 'INFO', 'Daily limit updated to $35.00 by user', 'cost-tracker'],
  ]
  for (const l of logs) insertLog.run(...l)

  // Notifications
  const insertNotif = db.prepare(
    'INSERT INTO notifications (id, type, title, body, read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const notifs: [string, string, string, string, number, string][] = [
    ['n01', 'task', 'Task Completed', 'Scrape competitor pricing data finished successfully', 1, '2026-02-07 06:15:00'],
    ['n02', 'task', 'Task Completed', 'Backup database to S3 finished successfully', 1, '2026-02-07 06:05:30'],
    ['n03', 'alert', 'Errors Detected', '3 payment gateway timeouts during overnight batch', 0, '2026-02-07 07:00:03'],
    ['n04', 'alert', 'Spend Warning', 'Daily spend has reached 80% of limit ($20/$25)', 0, '2026-02-07 14:00:00'],
    ['n05', 'info', 'Deployment Success', 'Staging environment deployed successfully', 0, '2026-02-07 10:08:00'],
    ['n06', 'system', 'Agent Restarted', 'Agent Zero restarted after configuration update', 1, '2026-02-07 06:00:00'],
  ]
  for (const n of notifs) insertNotif.run(...n)

  // Home messages
  const insertMsg = db.prepare(
    'INSERT INTO messages (id, role, content, channel, created_at) VALUES (?, ?, ?, ?, ?)'
  )
  const msgs: [string, string, string, string, string][] = [
    ['m01', 'user', 'Run the overnight batch and scrape competitor prices', 'home', '2026-02-07 06:00:00'],
    ['m02', 'agent', 'Starting overnight batch processing. I\'ll run the database backup first, then scrape competitor pricing data from all 5 configured sources.\n\n**Tasks queued:**\n1. Backup database to S3\n2. Scrape competitor pricing\n3. Process overnight invoices\n\nI\'ll send you a summary when everything is done.', 'home', '2026-02-07 06:00:05'],
    ['m03', 'agent', 'Overnight batch complete! Here\'s the summary:\n\n- **Backup**: 2.4GB uploaded to S3 successfully\n- **Pricing**: 847 products scraped, 12 priced below market\n- **Invoices**: 3 failed (payment gateway timeouts, will retry)\n\nThe full pricing comparison report is ready for review.', 'home', '2026-02-07 07:00:05'],
    ['m04', 'user', 'Great work. Deploy the latest changes to staging', 'home', '2026-02-07 10:00:00'],
    ['m05', 'agent', 'On it! Running the full test suite first.\n\n```\nRunning 142 tests...\n✓ 142/142 passed (0 failed)\n```\n\nAll tests green. Deploying to staging now...', 'home', '2026-02-07 10:00:15'],
  ]
  for (const m of msgs) insertMsg.run(...m)
}
