# Sincronização do Guia de Orlando

O guia funciona localmente com a compilação padrão. Para habilitar a viagem compartilhada, use um projeto Supabase controlado pelo responsável pelo guia.

1. Aplique `migrations/20261109000000_guia_viagens.sql` no banco do projeto. As tabelas privadas são acessadas pelas funções da migração.
2. Em Authentication, habilite e-mail com verificação e configure o template de Magic Link para enviar o código `{{ .Token }}`. Configure o SMTP para entregar códigos a convidados reais.
3. Defina `GUIA_CLOUD_URL` e `GUIA_CLOUD_PUBLISHABLE_KEY` como variáveis de ambiente para compilar localmente, ou como variáveis do repositório para o workflow. Use a origem HTTPS do projeto e uma chave `sb_publishable_`. Execute `python tools/build_site.py`.
4. Em Família e backup, entre por e-mail, crie a viagem e gere um código para outro e-mail. No segundo aparelho, entre com esse e-mail e aceite o código. Teste também a rejeição com um e-mail diferente e a remoção de acesso.

O organizador controla os convites. Membros podem editar datas, programação, rota e lista. O endereço cadastrado em Configurações, o nome do usuário, reservas, anexos, gastos e fotos ficam no aparelho. Uma reserva ou endereço digitado manualmente como atividade faz parte da programação compartilhada. A edição sem sinal fica local. Ao voltar a conexão com a sessão ativa, a sincronização tenta enviar a edição. Mudanças simultâneas na mesma viagem apresentam uma escolha de versão. Recomenda-se fazer uma cópia antes de substituir a versão local. Desvincular ou revogar acesso impede novas sincronizações, mas cópias já armazenadas em aparelhos de terceiros permanecem nesses aparelhos.

## Tempo de deslocamento pelo Google Maps

1. Em um projeto Google Cloud com Routes API habilitada, crie uma chave de servidor restrita à Routes API. Configure uma cota e alertas de cobrança.
2. Configure os segredos da função `GOOGLE_ROUTES_API_KEY`, `GUIA_CLOUD_PUBLISHABLE_KEY` e `GUIA_ALLOWED_ORIGINS`. A última variável lista origens de navegador separadas por vírgula, por exemplo `https://betobarbosa-collab.github.io`. O Supabase fornece `SUPABASE_URL`.
3. Faça deploy da função `guia-route` no projeto Supabase. A função valida a sessão pelo RPC de cota no banco antes de chamar o Google. O limite da função é de 12 consultas diárias por conta, além das cotas do projeto. Use `GUIA_ROUTES_ENABLED=true` na compilação para exibir o botão.

O app consulta sob demanda e mostra distância e tempo na ordem das paradas. O mapa local usa as coordenadas cadastradas com linhas de referência. Os blocos de rua são opcionais e são carregados sob demanda.
