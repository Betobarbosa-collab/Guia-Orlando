# Guia de Orlando — contexto para retomar o projeto

## Onde trabalhar

- O repositório GitHub é a fonte oficial. Comece pela `main` atualizada e abra uma branch para cada mudança. Faça push do trabalho em andamento antes de trocar de dispositivo e retome pela mesma branch ou pelo PR. O site público está em https://betobarbosa-collab.github.io/Guia-Orlando/.
- Use o Drive para arquivos privados, referências e cópias históricas. Ao recuperar algo do Drive, compare com o GitHub e traga apenas as mudanças verificadas.
- Registre no PR o objetivo, as decisões, os testes e o próximo passo. Use issues para pendências que sobrevivem ao PR e atualize este arquivo quando a arquitetura ou o processo de trabalho mudar. Guarde conversas exportadas com dados pessoais em armazenamento privado e registre aqui apenas as decisões técnicas necessárias.

## Arquitetura e edição

- PWA estática para celular, servida pelo GitHub Pages. `src/index.template.html` e `assets/` contêm o molde, estilos e JavaScript. `assets/trip.js` trata da viagem local, `assets/trip-cloud.js` da sincronização opcional e `assets/stores.js` da experiência de lojas.
- `planilha/guia-dados.xlsx` alimenta o catálogo. Valide com `python tools/build_data.py --check` (Python 3.12 e openpyxl 3.1.5, como no workflow). Para regenerar, execute `python tools/build_data.py` e depois `python tools/build_site.py`. Edite as fontes para atualizar `index.html` e `sw.js`.
- Use `python -m http.server 8080` para testar a PWA em localhost. Valide instalação, reabertura offline e os fluxos alterados. Para publicação, confirme o workflow do Pages, o commit publicado e a resposta do site. O workflow de dados gera os arquivos estáticos e pode gravar um commit próprio.
- O repositório e a publicação são públicos. Mantenha credenciais de servidor, dados pessoais e exportações privadas fora dos commits e do catálogo.

## Sincronização dos dados da viagem

- A documentação operacional está em [supabase/README.md](supabase/README.md). A publicação auditada no commit `6355961` em 23/11/2026 tinha URL e chave publicável vazias no HTML. O aplicativo opera com armazenamento local nessa configuração.
- Para ativar a viagem compartilhada, use um projeto Supabase controlado pelo responsável, aplique a migração, configure o login por código de e-mail e informe `GUIA_CLOUD_URL` e `GUIA_CLOUD_PUBLISHABLE_KEY` nas variáveis de publicação. Gere o build, verifique a configuração no site e teste em dois aparelhos com convite, alteração offline e reconexão, conflito de edição e revogação. A função de rotas é opcional.
- A sincronização cobre datas, programação, rota e lista. Endereço salvo em Configurações, nome, reservas, anexos, gastos e fotos ficam no aparelho. Atividades inseridas manualmente na programação podem incluir endereço ou detalhes de reserva e são compartilhadas.
