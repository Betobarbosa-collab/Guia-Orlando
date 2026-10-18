# Revisão de segurança (red team) — Guia de viagem PWA

**Escopo:** site estático no GitHub Pages (`index.html` único + `sw.js` + manifest), sem backend, sem contas, sem segredos.
**Data:** 18/10/2026. **Método:** revisão de código linha a linha, testes adversariais em simulador (JSDOM) e análise da cadeia de build.

## Modelo de ameaça
| Ativo | Risco | Quem ataca |
|---|---|---|
| Dados pessoais no aparelho (nome, endereço, GPS, lista, roteiro) | vazamento / alteração | site malicioso, XSS, extensão |
| Conteúdo público do site (lojas, pedidos da família) | exposição indesejada | qualquer pessoa com o link |
| Integridade do app | código injetado via planilha, importação ou APIs externas | editor da planilha, remetente de lista, serviço externo comprometido |
| Disponibilidade offline | cache envenenado / quebrado | rede hostil (Wi‑Fi público) |

## Superfície de ataque e controles
| Entrada | Controle |
|---|---|
| Texto da planilha (`data/*.json`) | `build_data.py` recusa qualquer `<…>`; o app nunca usa `innerHTML`; `rich()` só interpreta `**` e `_` |
| Lista importada (texto colado) | esquema fixo, limites de tamanho/quantidade, campos desconhecidos descartados, links só `http(s)`, fotos só `data:image/*` ≤ 300 KB |
| `localStorage` | lido com `try/catch`, saneado campo a campo, limite de 3,5 MB (fotos locais são removidas primeiro) |
| URL (`#hash`) | só nomes de abas existentes; nada é interpretado |
| APIs externas (Open‑Meteo, Frankfurter, er‑api, Nominatim) | respostas validadas por tipo e faixa; nunca renderizadas como HTML; timeout 8–10 s; Nominatim limitado a 1 consulta/s |
| Mapa (Leaflet) | vendorizado (sem CDN), tooltips criados como nós de texto, nunca HTML |
| Fotos dos pedidos (`foto_url`) | só `https://`; a CSP libera **apenas os hosts presentes na planilha** (gerado no build); `referrerpolicy=no-referrer`; cache de imagens limitado a 150 entradas |
| Links externos | `safeUrl()` (só `http/https`), `target=_blank` + `rel="noopener noreferrer"`; `window.open(..., "noopener")` |
| Iframe de terceiros | frame‑busting no início do script (GitHub Pages não envia `X-Frame-Options`) |

## CSP efetiva (gerada pelo build)
`default-src 'self'; script-src 'sha256-…'; style-src 'sha256-…'; img-src 'self' data: blob: <tiles OSM> <hosts das fotos>; font-src 'self' data:; connect-src 'self' api.open-meteo.com api.frankfurter.app open.er-api.com nominatim.openstreetmap.org; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; upgrade-insecure-requests`
Sem `unsafe-inline`, sem `unsafe-eval`, sem CDN. Qualquer script que não seja exatamente o embutido é bloqueado pelo navegador.

## Achados desta rodada (todos corrigidos)
| # | Gravidade | Achado | Correção |
|---|---|---|---|
| 1 | Média | `safeUrl("")` resolvia para a URL da própria página → botão "Abrir link" em pedidos sem link | retorno `null` para vazio |
| 2 | Média | Tooltips do Leaflet aceitam HTML; nomes vinham como string | nomes passados como nó de texto |
| 3 | Baixa | `img-src https:` amplo demais | hosts calculados a partir da planilha no build |
| 4 | Baixa | Geocodificação sem limite de taxa (política do Nominatim) | 1 consulta/s, uma por vez, só sob ação do usuário |
| 5 | Baixa | `localStorage` sem teto (fotos locais podem estourar a cota) | limite de 3,5 MB; fotos locais removidas primeiro |
| 6 | Baixa | Respostas de clima usadas sem validar tipo/faixa | validação de tipos, faixas e tamanho |
| 7 | Baixa | Cache de imagens do service worker sem limite | máximo de 150 entradas (FIFO) |
| 8 | Baixa | Página podia ser embutida em iframe de terceiro | frame‑busting |
| 9 | Info | Estado de scroll via `style` inline | classe `noscroll` |

## Riscos residuais (aceitos, com justificativa)
- **O site é público.** Tudo em `data/` é visível a quem tiver o link; por isso nome, endereço, GPS e marcações ficam **só no aparelho**. Não coloque dados pessoais na planilha. `noindex` evita indexação, não acesso.
- **Fotos de terceiros** são carregadas dos hosts listados na planilha (hoje só `assets2.oakley.com`): esses servidores veem o IP do aparelho. Sem referrer, sem cookies.
- **Serviços públicos (clima, câmbio, geocodificação)** recebem coordenadas / o endereço digitado. Nunca nome ou lista.
- **GitHub Actions** usa `actions/checkout@v4` e `actions/setup-python@v5` por tag (não por SHA). Para endurecer, troque por SHA fixo.
- **Dependência única:** Leaflet 1.9.4 (BSD‑2), vendorizado. Revise a cada 6 meses.
- **Clickjacking** só é mitigado por JS; o Pages não permite cabeçalhos HTTP.

## Checklist de deploy
1. Repositório **pessoal**, Public; nunca conta corporativa.
2. `Settings → Actions → General → Workflow permissions → Read and write` (antes do primeiro upload).
3. Subir tudo do zip; conferir `.github/workflows/build-data.yml`.
4. `Settings → Pages → main / root`.
5. Actions: "Planilha → dados do site" verde; "pages build and deployment" verde.
6. Abrir o site no celular, instalar, permitir localização uma vez.
7. Para atualizar: editar a planilha → upload em `planilha/` → esperar a Action → abrir o app com internet.

## Como testar você mesmo (5 min)
- Cole na importação um texto com `<img src=x onerror=alert(1)>` no nome de um pedido → deve aparecer como texto, sem alerta.
- Cole `javascript:alert(1)` como link de um pedido → "Link inválido".
- Abra o site num iframe → ele sai do iframe.
- DevTools → Console: nenhuma violação de CSP ao usar o app (mapa, clima, cotação).
