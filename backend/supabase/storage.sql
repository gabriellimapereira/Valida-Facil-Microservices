-- =====================================================================
-- Valida Fácil — bucket de Storage para relatórios gerados pelo backend
-- =====================================================================

-- 1) Crie o bucket pelo Dashboard: Storage > New bucket > nome "reports",
--    marcado como PRIVADO (Public = desligado). Ou, alternativamente,
--    rode o insert abaixo no SQL Editor:

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- 2) RLS do Storage: cada usuário só pode ler/gravar arquivos dentro da
--    "pasta" (prefixo do nome do arquivo) que corresponde ao ID da
--    própria empresa — o backend sempre salva como "{company_id}/arquivo.pdf",
--    então isso impede uma empresa de acessar relatório de outra mesmo
--    tendo o link, caso a signed URL vaze ou expire mal.

create policy "select_own_company_reports"
  on storage.objects for select
  using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (
      select company_id::text from profiles where id = auth.uid()
    )
  );

create policy "insert_own_company_reports"
  on storage.objects for insert
  with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (
      select company_id::text from profiles where id = auth.uid()
    )
  );
