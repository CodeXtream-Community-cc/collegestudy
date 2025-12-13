-- Remove legacy session linkage from PYQ documents now that PYQs are independent
alter table public.pyq_documents
  drop column if exists session_id;
