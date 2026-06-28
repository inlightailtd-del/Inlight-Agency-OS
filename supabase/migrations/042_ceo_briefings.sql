-- CEO Briefings & Financial Analysis
-- Uses existing agent_memory table with new categories:
--   ceo_morning_briefing
--   ceo_evening_briefing
--   ceo_pnl_analysis
--   ceo_cashflow_prediction
--   ceo_budget_suggestions
--   ceo_meeting_simulation
--   ceo_voice_report

-- Add RLS policies for the new categories (already covered by existing RLS on agent_memory)

-- Create index for faster CEO briefing lookups
create index if not exists idx_agent_memory_ceo_categories
  on agent_memory(user_id, category)
  where category in (
    'ceo_morning_briefing',
    'ceo_evening_briefing',
    'ceo_pnl_analysis',
    'ceo_cashflow_prediction',
    'ceo_budget_suggestions',
    'ceo_meeting_simulation',
    'ceo_voice_report'
  );
