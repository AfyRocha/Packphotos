-- Kit Restaurante Lucrativo — schema da tabela de pedidos.
-- Rode este bloco no SQL Editor do Supabase (mesmo projeto usado pelo Pack Brasil).
-- Segue o mesmo padrão da tabela "orders": RLS habilitado, sem policies públicas
-- (Opção B — o navegador nunca acessa o Supabase direto, só via /api com service role).

-- 1. Enum de status do pedido
create type restaurant_order_status as enum (
  'aguardando_pagamento',
  'pagamento_confirmado',
  'pagamento_recusado'
);

-- 2. Sequência para o número do pedido (KR-0001, KR-0002, ...)
create sequence restaurant_order_number_seq start 1;

-- 3. Tabela principal
create table restaurant_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default '',

  -- Dados do cliente
  client_name text not null,
  restaurant_name text not null,
  city text not null,
  email text not null,
  whatsapp text not null,
  instagram text,

  -- Dados do diagnóstico gratuito
  gmb_link text,
  operation_type text not null,
  has_digital_menu text not null,
  has_instagram text not null,
  google_reviews text,
  avg_ticket text,
  notes text,

  -- Pagamento
  amount_cents integer not null,
  status restaurant_order_status not null default 'aguardando_pagamento',
  payment_id text,
  payment_method text,
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Trigger: gera "KR-0001" automaticamente no insert
create or replace function set_restaurant_order_number()
returns trigger as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'KR-' || lpad(nextval('restaurant_order_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_restaurant_order_number
before insert on restaurant_orders
for each row execute function set_restaurant_order_number();

-- 5. Trigger: mantém updated_at em dia
create or replace function set_restaurant_orders_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_restaurant_orders_updated_at
before update on restaurant_orders
for each row execute function set_restaurant_orders_updated_at();

-- 6. Índices úteis
create index idx_restaurant_orders_status on restaurant_orders(status);
create index idx_restaurant_orders_order_number on restaurant_orders(order_number);

-- 7. RLS habilitado, sem policies (somente o backend com service_role acessa)
alter table restaurant_orders enable row level security;
