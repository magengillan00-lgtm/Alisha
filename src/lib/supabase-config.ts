/**
 * إعدادات Supabase لمشروع Alisha.
 * تُقرأ من متغيرات البيئة (NEXT_PUBLIC_*) التي تُضمَّن في الـ bundle عند البناء.
 * في التطوير المحلي: من .env.local
 * في GitHub Pages: من GitHub Secrets عبر workflow
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khgvmatuqqgpctimzcoi.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoZ3ZtYXR1cXFncGN0aW16Y29pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3Mzg2NzAsImV4cCI6MjA5NzMxNDY3MH0.apsayk4Nh_sMv1LQefzK_23GL3Uj4kEu8GbBJ05frE4';

export const IS_SUPABASE_CONFIGURED = true;
