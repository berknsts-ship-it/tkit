-- Таблица счётчиков ИИ-запросов (один ряд = один репетитор + один день)
CREATE TABLE IF NOT EXISTS public.ai_usage (
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date     date NOT NULL DEFAULT CURRENT_DATE,
  requests int  NOT NULL DEFAULT 0,
  PRIMARY KEY (tutor_id, date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor sees own usage" ON public.ai_usage
  FOR SELECT USING (auth.uid() = tutor_id);

-- Атомарный инкремент: INSERT ... ON CONFLICT DO UPDATE
-- Возвращает новое значение счётчика (уже после +1)
CREATE OR REPLACE FUNCTION public.ai_usage_increment(p_tutor_id uuid, p_date date)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO public.ai_usage (tutor_id, date, requests)
  VALUES (p_tutor_id, p_date, 1)
  ON CONFLICT (tutor_id, date)
  DO UPDATE SET requests = ai_usage.requests + 1
  RETURNING requests;
$$;
