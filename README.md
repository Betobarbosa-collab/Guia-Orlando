# Guia de viagem (PWA offline)

App de compras, descontos e ajuda para viagem, feito para celular. Um site estático (HTML/CSS/JS) que
funciona **sem internet** depois da primeira abertura e pode ser **instalado** como app (Android e iPhone).
Todo o conteúdo vem de `data/*.json`, que você edita por uma planilha Excel.

## Publicar no GitHub Pages (5 minutos)

1. Crie um repositório **na sua conta pessoal** (não use conta corporativa) e envie todos estes arquivos para a raiz.
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)`** → Save.
3. Em 1–2 minutos o site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.
4. Abra no celular pelo Chrome → menu ⋮ → **Instalar app**. Pronto: ícone na tela e uso offline.

> GitHub Pages é público. Qualquer pessoa com o link vê o conteúdo de `data/`. Por isso o endereço da casa, nome e lista
> local ficam **apenas no aparelho** (localStorage); nada é enviado a servidor. Não coloque dados pessoais na planilha.
> Se quiser que a página não seja indexada, já está com `noindex`; para privacidade total, use um nome de repositório
> difícil de adivinhar ou um plano com Pages privado.

## Atualizar conteúdo (lojas, lugares, dicas, pedidos em massa)

**Pela planilha (recomendado):** edite `planilha/guia-dados.xlsx` no Excel e envie o arquivo pelo GitHub
(*Add file → Upload files* na pasta `planilha/`). A automação em `.github/workflows/build-data.yml` roda
`tools/build_data.py`, valida tudo e grava `data/*.json`. Se houver erro (ex.: HTML no texto, coordenada inválida,
id repetido), o workflow falha e mostra a linha problemática em *Actions*.

**Localmente:** `pip install openpyxl` e `python tools/build_data.py` (ou `--check` só para validar).

A aba **Leia-me** da planilha explica cada coluna. Resumo:

| Aba | O que alimenta |
|---|---|
| Lojas | Aba Lojas do app (redes de desconto, por grupo) |
| Lugares | Regiões, outlets, parques e Miami (grupo com "Parques" ou "Miami" vai para as abas correspondentes) |
| Dicas | Cartões da aba Dicas (`icone`: compass, gift, phone, car, sale, map, device, tag, fork, dollar, customs, passport, health, bulb) |
| Pontos / Tipos / Regioes | Planejador "Perto", aba Lojas → Compras (centros, cupons, melhores Walmart/Target) e busca por apelido (coluna `apelidos`); coluna `cupom` diz onde pegar o livro de descontos |
| Descontos | Chips do dia e lista da semana na aba Hoje |
| Frases | Frases em inglês para o caixa |
| Pessoas / Pedidos | Lista da família pré-carregada (pedidos em massa). A coluna `onde` (redes separadas por `;`) faz cada loja e cada ponto do "Perto" mostrar os pedidos que dá para achar ali. Marcações de "comprado" ficam no celular |
| Eventos | Aba **Agenda**: eventos com data de início/fim, categoria (natal, parque, esporte, show, gratis, feira, compras, tampa), horário, dias da semana e datas sem evento |
| Lotacao | Previsão de lotação por dia (ex.: Universal) mostrada no calendário e na aba Hoje |
| Config | Título, subtítulo, versão, imposto e cotação padrão, cota, raio em km |

Tabelas de tamanho ficam só em `data/tamanhos.json` e a tabela de multidão dos parques em `data/descontos.json`
(`parques_semana`), porque mudam raramente.

Texto aceita `**negrito**` e `_itálico_`. HTML é recusado de propósito (ver Segurança).

## Recursos que usam internet (opcionais)

O app continua 100% funcional sem sinal; com internet ganha quatro coisas, todas de serviços públicos, sem chave de API:

| Recurso | Serviço | Onde aparece | Cache offline |
|---|---|---|---|
| Clima do dia (temperatura, chuva, UV) | Open-Meteo | Chip na aba Hoje | Último valor guardado (marca "antigo" após 3 h) |
| Cotação USD→BRL automática | Frankfurter (BCE); reserva: open.er-api.com | Conversor e total da lista; sobrescrevível em Configurações | Última cotação guardada (12 h) |
| Localização do endereço da casa | Nominatim (OpenStreetMap) | Configurações → vira ponto de partida em "Perto" e no clima | Coordenadas guardadas no aparelho |
| Endereço digitado em "Perto" | Nominatim | Lista de lojas a partir de qualquer hotel/bairro | Sem sinal, cai para links do Google Maps |
| Mapa interativo com pinos por tipo | Leaflet (vendorizado) + tiles do OpenStreetMap | "Perto" → Lista/Mapa | Sem sinal mostra aviso; a lista segue |
| Nota do Google e "aberto agora" | Dados da planilha (`nota`, `avaliacoes`, `horario_dias`) | Linhas e detalhe de cada lugar | Local, sempre |

Os domínios permitidos estão na CSP do `index.html` (`connect-src` e `img-src`); qualquer outro é bloqueado pelo navegador.
Políticas de uso: Nominatim pede uso leve (o app faz no máximo uma consulta por ação do usuário) e os tiles do OSM
exigem atribuição (mantida no mapa). Leaflet é BSD-2 (licença em `assets/vendor/leaflet/`).

## Estrutura

O celular baixa **um arquivo só**: `index.html` (estilo, lógica, mapa, fontes e dados embutidos, ~420 KB), mais `sw.js`,
o manifest e os ícones. Tudo o mais é fonte para gerar esse arquivo.

```
index.html                 GERADO — o app inteiro num arquivo (não edite à mão)
sw.js                      GERADO — service worker; versão muda a cada build (atualização automática)
manifest.webmanifest       instalação como app
assets/icons               ícones do app
src/index.template.html    molde do index.html (casca + CSP com hashes)
assets/app.css, app.js     estilo e lógica (fonte)
assets/fonts, vendor       DM Sans, Fraunces e Leaflet 1.9.4 (embutidos no build)
data/*.json                conteúdo gerado pela planilha
planilha/guia-dados.xlsx   fonte de verdade editável
tools/build_data.py        planilha → data/*.json (com validação)
tools/build_site.py        fontes + data → index.html e sw.js
.github/workflows          roda os dois scripts a cada mudança e faz o commit
```

Para gerar localmente: `python tools/build_data.py && python tools/build_site.py`.

## Segurança (o que foi feito)

Relatório completo de red team, com modelo de ameaça, achados corrigidos e riscos residuais: **[SECURITY.md](SECURITY.md)**.

- **CSP estrita** no `index.html`: o script e o estilo embutidos são autorizados por **hash SHA-256** (sem `unsafe-inline`); fontes embutidas; requisições de rede apenas aos quatro serviços públicos listados acima; `object-src 'none'`,
  `base-uri 'none'`, `form-action 'none'`. Nenhum CDN, nenhum script de terceiro, nenhum tracker.
- **Sem `innerHTML` com dados.** Tudo é montado via DOM; o texto curado aceita apenas `**` e `_`.
  O conversor da planilha recusa HTML.
- **Links**: só `http(s)`; sempre `target="_blank" rel="noopener noreferrer"`. Links do Google Maps são
  construídos pelo app com `encodeURIComponent`.
- **Importação de lista (texto colado)**: validação de esquema, limites de tamanho/quantidade, descarte de campos
  desconhecidos, fotos só `data:image/*` até 300 KB. `localStorage` é lido com `try/catch` e saneado.
- **Service worker** só faz cache do próprio domínio; dados usam rede-primeiro para refletir a planilha.
- **Privacidade**: nome, endereço, cotação, roteiro e lista local nunca saem do aparelho. `noindex` no site.
- **Supply chain**: fontes vendorizadas (fontsource, sem CDN); workflow com `openpyxl` fixado e `permissions: contents: write` apenas.
- Dependências de runtime: apenas Leaflet, copiado para o repositório (sem CDN) e carregado com a mesma CSP.

## Desenvolvimento local

```
python -m http.server 8080   # abra http://localhost:8080
```
Para testar o service worker é preciso HTTPS ou `localhost`. Não é preciso mexer em versão de cache: o `sw.js` gerado
leva um hash do `index.html`, e o app usa rede‑primeiro para a página — com internet ela abre sempre na versão mais nova;
sem internet, abre a última guardada.
