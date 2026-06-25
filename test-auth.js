import { createClient } from '@supabase/supabase-js';

const url = 'https://jtgnxbfgfqzyknbvytkm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0Z254YmZnZnF6eWtuYnZ5dGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTE5MTAsImV4cCI6MjA5NzY4NzkxMH0.B9OfFD7a6cJt8FUtK-wcNnGkuf1cxaSGPG6quK1vsXk';

const supabase = createClient(url, key);

async function run() {
  console.log(`Querying exams...`);
  const { data, error } = await supabase.from('exams').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Exams:', data);
  }
}
run();
