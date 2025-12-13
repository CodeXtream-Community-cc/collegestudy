-- Create junction table for exam schedule branches
-- This allows exam schedules to be associated with multiple branches

CREATE TABLE IF NOT EXISTS exam_schedule_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_schedule_id UUID NOT NULL REFERENCES exam_schedule(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(exam_schedule_id, branch_id)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_exam_schedule_branches_exam_schedule_id ON exam_schedule_branches(exam_schedule_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedule_branches_branch_id ON exam_schedule_branches(branch_id);

-- Add RLS policies
ALTER TABLE exam_schedule_branches ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read exam schedule branches
CREATE POLICY "Authenticated users can view exam schedule branches" ON exam_schedule_branches
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for authenticated users to insert exam schedule branches
CREATE POLICY "Authenticated users can insert exam schedule branches" ON exam_schedule_branches
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy for authenticated users to update exam schedule branches
CREATE POLICY "Authenticated users can update exam schedule branches" ON exam_schedule_branches
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy for authenticated users to delete exam schedule branches
CREATE POLICY "Authenticated users can delete exam schedule branches" ON exam_schedule_branches
  FOR DELETE USING (auth.role() = 'authenticated');

-- Migrate existing data from exam_schedule.branch_id to the new junction table
INSERT INTO exam_schedule_branches (exam_schedule_id, branch_id)
SELECT id, branch_id
FROM exam_schedule
WHERE branch_id IS NOT NULL
ON CONFLICT (exam_schedule_id, branch_id) DO NOTHING;

-- Note: We're keeping the branch_id column in exam_schedule for backward compatibility
-- but the application should now use the junction table for new operations
