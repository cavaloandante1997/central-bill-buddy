-- Create app_role enum for future role management
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- Create profiles table (extends Supabase Auth users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  proxy_email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create services table (tracks bill issuers like EDP, MEO, etc.)
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issuer TEXT NOT NULL,
  contract_number TEXT,
  autopay BOOLEAN DEFAULT FALSE,
  autopay_limit_cents INT,
  category TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Services policies
CREATE POLICY "Users can manage own services"
  ON public.services FOR ALL
  USING (auth.uid() = user_id);

-- Create invoices table (tracks individual bills)
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  issue_date DATE,
  due_date DATE NOT NULL,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  currency TEXT DEFAULT 'EUR' NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'overdue')),
  source_email_hash TEXT,
  pdf_url TEXT,
  parsed_fields JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Invoices policies (via services ownership)
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.services
      WHERE services.id = invoices.service_id
      AND services.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.services
      WHERE services.id = invoices.service_id
      AND services.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own invoices"
  ON public.invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.services
      WHERE services.id = invoices.service_id
      AND services.user_id = auth.uid()
    )
  );

-- Create payment_intents table (tracks Multibanco references)
CREATE TABLE public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  psp TEXT NOT NULL CHECK (psp IN ('MOCK', 'EASYPAY', 'IFTHENPAY', 'SIBS', 'STRIPE')),
  psp_payment_id TEXT,
  entity TEXT,
  reference TEXT,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
  webhook_log JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on payment_intents
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

-- Payment intents policies (via invoices -> services ownership)
CREATE POLICY "Users can view own payment intents"
  ON public.payment_intents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      JOIN public.services ON services.id = invoices.service_id
      WHERE invoices.id = payment_intents.invoice_id
      AND services.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own payment intents"
  ON public.payment_intents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices
      JOIN public.services ON services.id = invoices.service_id
      WHERE invoices.id = payment_intents.invoice_id
      AND services.user_id = auth.uid()
    )
  );

-- Create logs table for observability
CREATE TABLE public.logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on logs
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Logs policies
CREATE POLICY "Users can view own logs"
  ON public.logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
  ON public.logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  random_suffix TEXT;
BEGIN
  -- Generate a random 8-character suffix for proxy email
  random_suffix := LOWER(SUBSTRING(MD5(RANDOM()::TEXT || NEW.id::TEXT) FROM 1 FOR 8));
  
  -- Insert profile with generated proxy email
  INSERT INTO public.profiles (id, email, proxy_email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    'u_' || random_suffix || '@centralpay.pt',
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_services_user_id ON public.services(user_id);
CREATE INDEX idx_invoices_service_id ON public.invoices(service_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_payment_intents_invoice_id ON public.payment_intents(invoice_id);
CREATE INDEX idx_payment_intents_status ON public.payment_intents(status);
CREATE INDEX idx_logs_user_id ON public.logs(user_id);
CREATE INDEX idx_logs_created_at ON public.logs(created_at DESC);