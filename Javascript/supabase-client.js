window.IMS = window.IMS || {};

if (!window.supabase?.createClient) {
  throw new Error('Supabase SDK failed to load. Check the Supabase CDN script.');
}

const supabaseUrl = 'https://lwkodejairmfoggqxiyf.supabase.co';
const supabasePublishableKey = 'sb_publishable_G8AKgCsG2YJuBzK2Ifrw0A_2LbPLID5';

window.IMS.supabase = window.supabase.createClient(supabaseUrl, supabasePublishableKey);
