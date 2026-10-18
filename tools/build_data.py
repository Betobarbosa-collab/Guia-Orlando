#!/usr/bin/env python3
"""Converte planilha/guia-dados.xlsx -> data/*.json (o app lê os JSON).
Uso: python tools/build_data.py [--check]
Regras: ids são gerados do nome quando a coluna id está vazia; células com
várias linhas (Alt+Enter) viram listas; texto aceita **negrito** e _itálico_."""
import json, re, sys, unicodedata
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "planilha" / "guia-dados.xlsx"
DATA = ROOT / "data"
CORES = {"sun", "leaf", "sky", "coral", "gray"}
DIAS = {"dom": 0, "seg": 1, "ter": 2, "qua": 3, "qui": 4, "sex": 5, "sab": 6, "sáb": 6, "todo dia": -1, "todos": -1}
errors = []

def slug(s, n=48):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:n]

def clean(v, max_len=600):
    if v is None: return ""
    v = str(v).replace("\r", "").strip()
    if "<" in v and ">" in v: errors.append(f"HTML não é permitido: {v[:50]!r}")
    return v[:max_len]

def lines(v): return [x.strip() for x in clean(v, 6000).split("\n") if x.strip()]

def rows(ws):
    it = ws.iter_rows(values_only=True)
    header = [clean(c).lower() for c in next(it)]
    out = []
    for r in it:
        if not any(c not in (None, "") for c in r): continue
        out.append({header[i]: r[i] for i in range(min(len(header), len(r)))})
    return out

def num(v, lo, hi, what):
    try: f = float(str(v).replace(",", "."))
    except Exception: errors.append(f"{what}: número inválido {v!r}"); return None
    if not (lo <= f <= hi): errors.append(f"{what}: fora do intervalo {f}")
    return round(f, 5)

def grupos(sheet_rows, nome_sheet):
    out, idx = [], {}
    for r in sheet_rows:
        g = clean(r.get("grupo")); n = clean(r.get("nome"), 120)
        if not g or not n: errors.append(f"{nome_sheet}: linha sem grupo/nome ({r})"); continue
        tagc = clean(r.get("cor_etiqueta")).lower() or "sky"
        if tagc not in CORES: errors.append(f"{nome_sheet}/{n}: cor_etiqueta '{tagc}' inválida (use {sorted(CORES)})")
        item = {"id": slug(n), "n": n, "tag": clean(r.get("etiqueta"), 80), "tagc": tagc}
        q = clean(r.get("busca_no_maps"), 80); p = clean(r.get("perto_da_casa"), 160)
        if q: item["q"] = q
        if p: item["perto"] = p
        item["d"] = lines(r.get("dicas"))
        if not item["d"]: errors.append(f"{nome_sheet}/{n}: sem dicas")
        if g not in idx: idx[g] = len(out); out.append({"grupo": g, "itens": []})
        out[idx[g]]["itens"].append(item)
    return out

def build():
    wb = load_workbook(XLSX, data_only=True)
    sh = {ws.title.lower(): rows(ws) for ws in wb.worksheets}
    # Config
    cfg = json.loads((DATA / "config.json").read_text(encoding="utf-8")) if (DATA / "config.json").exists() else {}
    for r in sh.get("config", []):
        k = clean(r.get("chave")); v = r.get("valor")
        if not k: continue
        if k in ("imposto_padrao", "cotacao_padrao"): v = num(v, 0, 100, k)
        elif k in ("cota_usd", "raio_km"): v = int(num(v, 0, 100000, k) or 0)
        else: v = clean(v, 120)
        cfg[k] = v
    # Lojas / Lugares / Dicas
    lojas = grupos(sh.get("lojas", []), "Lojas")
    lugares = grupos(sh.get("lugares", []), "Lugares")
    dicas = []
    for r in sh.get("dicas", []):
        t = clean(r.get("titulo"), 90)
        if not t: continue
        dicas.append({"id": slug(t), "t": t, "icon": clean(r.get("icone"), 20) or "bulb", "resumo": clean(r.get("resumo"), 160), "b": lines(r.get("itens")), "src": clean(r.get("fonte"), 200)})
    # Pontos / Regioes / Tipos
    tipos = {}
    for r in sh.get("tipos", []):
        c = clean(r.get("codigo"), 20)
        if c: tipos[c] = {"n": clean(r.get("nome"), 60), "b": clean(r.get("etiqueta"), 40), "bc": clean(r.get("cor")).lower() or "sky"}
    regioes = []
    for r in sh.get("regioes", []):
        n = clean(r.get("nome"), 60)
        if not n: continue
        regioes.append({"g": clean(r.get("grupo"), 30), "id": clean(r.get("id"), 10) or slug(n, 10), "n": n, "la": num(r.get("lat"), -90, 90, n), "lo": num(r.get("lng"), -180, 180, n), "al": [x.strip() for x in clean(r.get("apelidos"), 300).split(";") if x.strip()]})
    pontos = []
    for r in sh.get("pontos", []):
        c = clean(r.get("tipo"), 20); a = clean(r.get("endereco"), 160)
        if not c or not a: continue
        if c not in tipos: errors.append(f"Pontos: tipo '{c}' não existe na aba Tipos ({a})")
        p = {"c": c, "a": a, "la": num(r.get("lat"), -90, 90, a), "lo": num(r.get("lng"), -180, 180, a), "h": clean(r.get("horario"), 90)}
        n = clean(r.get("nome"), 90)
        if n: p["n"] = n
        if r.get("nota") not in (None, ""): p["r"] = num(r.get("nota"), 0, 5, a)
        if r.get("avaliacoes") not in (None, ""): p["v"] = int(num(r.get("avaliacoes"), 0, 1e8, a) or 0)
        dica = clean(r.get("dica"), 400)
        if dica: p["dica"] = dica
        hd = clean(r.get("horario_dias"), 200)
        if hd:
            parts = [x.strip() for x in hd.split("|")]
            if len(parts) != 7 or not all(re.match(r"^(\d{1,2}:\d{2}-\d{1,2}:\d{2}|fechado|)$", x) for x in parts):
                errors.append(f"Pontos/{a}: horario_dias precisa de 7 faixas separadas por | (Dom..Sáb), ex.: 10:00-22:00|...|")
            else: p["hd"] = parts
        pontos.append(p)
    # Descontos (tabela de parques fica no JSON existente)
    desc = json.loads((DATA / "descontos.json").read_text(encoding="utf-8")) if (DATA / "descontos.json").exists() else {}
    senior = []
    for r in sh.get("descontos", []):
        loja = clean(r.get("loja"), 60)
        if not loja: continue
        d = clean(r.get("dia")).lower()[:8]
        dia = next((v for k, v in DIAS.items() if d.startswith(k)), None)
        if dia is None: errors.append(f"Descontos/{loja}: dia '{d}' inválido (Seg…Dom ou Todo dia)"); dia = -1
        s = {"dia": dia, "loja": loja, "idade": int(num(r.get("idade"), 0, 120, loja) or 0), "desc": clean(r.get("desconto"), 10), "nota": clean(r.get("nota"), 300), "pedir": clean(r.get("frase_ingles"), 160)}
        if clean(r.get("so_primeira_terca")).lower() in ("s", "sim", "x", "true", "1"): s["first"] = True
        senior.append(s)
    desc["senior"] = senior
    frases = [[clean(r.get("ingles"), 160), clean(r.get("portugues"), 160), clean(r.get("grupo"), 40) or "Frases"] for r in sh.get("frases", []) if clean(r.get("ingles"))]
    pessoas = [{"id": clean(r.get("id"), 40) or slug(r.get("nome"), 20), "nome": clean(r.get("nome"), 60), "tam": clean(r.get("tamanhos"), 500)} for r in sh.get("pessoas", []) if clean(r.get("nome")) and not clean(r.get("id")).startswith("ex-")]
    pedidos = []
    for r in sh.get("pedidos", []):
        item = clean(r.get("item"), 120)
        if not item or "(exemplo" in item.lower() or clean(r.get("pessoa_id")).startswith("ex-"): continue
        link = clean(r.get("link"), 500)
        fu = clean(r.get("foto_url"), 500)
        if fu and not re.match(r"^https://", fu): errors.append(f"Pedidos/{item}: foto_url deve começar com https://"); fu = ""
        if link and not re.match(r"^https?://", link): errors.append(f"Pedidos/{item}: link deve começar com http(s)://"); link = ""
        pedidos.append({"id": clean(r.get("id"), 40) or ("p-" + slug(item, 30)), "pessoa": clean(r.get("pessoa_id"), 40), "nome": item, "loja": clean(r.get("loja"), 80), "cor": clean(r.get("cor"), 40), "tam": clean(r.get("tamanho"), 40), "preco": num(r.get("preco_usd") or 0, 0, 1e6, item) or 0, "link": link, "obs": clean(r.get("observacoes"), 300), "onde": clean(r.get("onde"), 160), "fotoUrl": fu, "foto": ""})
    ids = [p["id"] for p in pedidos]
    for d_ in {x for x in ids if ids.count(x) > 1}: errors.append(f"Pedidos: id repetido '{d_}' (preencha a coluna id com valores diferentes)")
    if errors:
        print("ERROS:\n - " + "\n - ".join(errors)); sys.exit(1)
    out = {"config.json": cfg, "lojas.json": lojas, "lugares.json": lugares, "dicas.json": dicas, "pontos.json": {"regioes": regioes, "tipos": tipos, "pontos": pontos}, "descontos.json": desc, "frases.json": frases, "pedidos.json": {"pessoas": pessoas, "pedidos": pedidos}}
    if "--check" in sys.argv:
        print("OK (apenas verificação)"); return
    for name, obj in out.items():
        (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"OK: {sum(len(g['itens']) for g in lojas)} lojas, {sum(len(g['itens']) for g in lugares)} lugares, {len(dicas)} dicas, {len(pontos)} pontos, {len(pedidos)} pedidos, {len(pessoas)} pessoas")

if __name__ == "__main__":
    build()
