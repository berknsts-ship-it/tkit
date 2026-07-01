-- Таблица абонементов
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id   uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  name         text        NOT NULL DEFAULT '8 занятий',
  total_amount int         NOT NULL,
  balance      int         NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  status       text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled'))
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor manages own subscriptions" ON public.subscriptions
  FOR ALL USING (auth.uid() = tutor_id);

-- Добавляем поля к урокам
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id),
  ADD COLUMN IF NOT EXISTS deducted_amount int;

-- Атомарное списание с баланса
CREATE OR REPLACE FUNCTION public.subscription_deduct(p_id uuid, p_amount int)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.subscriptions
  SET balance = balance - p_amount
  WHERE id = p_id;
$$;
