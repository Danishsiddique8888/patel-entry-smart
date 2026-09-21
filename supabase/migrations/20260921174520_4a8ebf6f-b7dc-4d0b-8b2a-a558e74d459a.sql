CREATE TABLE public.visitor_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL UNIQUE,
  vehicle_number TEXT,
  photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.visit_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id UUID NOT NULL REFERENCES public.visitor_profiles(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  delivery_company TEXT,
  block TEXT NOT NULL,
  flat_number TEXT NOT NULL,
  vehicle_number TEXT,
  visit_status TEXT NOT NULL DEFAULT 'Pending Approval',
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visit_records_visitor ON public.visit_records(visitor_id, visited_at DESC);

GRANT ALL ON public.visitor_profiles TO service_role;
GRANT ALL ON public.visit_records TO service_role;

ALTER TABLE public.visitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_records ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_visitor_profiles_updated_at
BEFORE UPDATE ON public.visitor_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();