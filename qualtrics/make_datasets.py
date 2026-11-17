#!/usr/bin/env python3
"""
Curtains Pilot 1 — turn a Qualtrics export into analysis tables.

The game sends its data to Qualtrics in pieces (curtains_01, curtains_02, ...).
This script joins the pieces back together for every response and writes:

  raw/          (contains Prolific IDs — keep in UBC storage, e.g. Teams/OneDrive)
    participants.csv        one row per response: condition, consent, timing,
                            demographics, comprehension, click checks, bonus
    trials.csv              one row per round (practice + main)
    questionnaires_long.csv one row per item
    questionnaires_wide.csv one row per participant x game, with scale scores
    prolific_bonus.csv      paste into Prolific's bulk bonus box (ID,amount in £)

  deidentified/ (same tables with Prolific/Qualtrics IDs replaced by P001, P002...)
    ...                     the version to clean further and share (BREB 8.4)
    id_key_KEEP_PRIVATE.csv links P-numbers to Prolific IDs — keep it with
                            the raw data, never share it

Usage
  1. In Qualtrics: Data & Analysis → Export & Import → Export data → CSV,
     "Download all fields", "Use choice text". Unzip it.
  2. python make_datasets.py path/to/export.csv
     (add --out some_folder to choose where the tables go; add any
      curtains_pilot1_*.json files participants sent you after a failed save)

Needs Python 3.8+ and pandas (pip install pandas).
"""
import argparse
import json
import random
import sys
from pathlib import Path

import pandas as pd

DIMS = {"c": "color", "t": "topbottom", "l": "leftright", "d": "dots", "s": "star"}
DQ_ITEMS = ["dqgeq_2", "dqgeq_3", "dqgeq_5", "dqgeq_6", "dqgeq_7"]
GEQ_ITEMS = ["dqgeq_1", "dqgeq_4"]
FLOW_ITEMS = ["flow_immersive", "flow_engaging", "flow_engrossing", "flow_absorbing"]
ID_COLS = ["ResponseId", "PROLIFIC_PID", "STUDY_ID", "SESSION_ID"]


def read_qualtrics(path):
    """Read a Qualtrics CSV export (3 header rows) as text."""
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    # Qualtrics adds two extra header rows: question text and ImportId JSON.
    df = df[~df.get("ResponseId", pd.Series(dtype=str)).isin(["Response ID", "ResponseId"])]
    df = df[~df.iloc[:, 0].astype(str).str.startswith('{"ImportId"')]
    return df.reset_index(drop=True)


def unpack(row):
    """Join curtains_NN pieces and parse them. Returns (payload, problem)."""
    try:
        n = int(float(row.get("curtains_nchunks", "") or 0))
    except ValueError:
        n = 0
    if n == 0:
        return None, "no game data"
    parts = []
    for i in range(1, n + 1):
        col = f"curtains_{i:02d}"
        if col not in row:
            return None, f"missing column {col} (declare more curtains_NN fields in Qualtrics)"
        parts.append(row[col])
    try:
        return json.loads("".join(parts)), None
    except json.JSONDecodeError as e:
        return None, f"pieces don't join into valid data ({e})"


def tables_for(ids, data):
    """Build the per-participant rows from one unpacked payload."""
    p, end, demo = data["p"], data["end"], data["demo"]
    comp = data.get("comp", [])
    main = [r for r in data["t"] if r[1] == "m"]
    part = {
        **ids,
        "condition": p.get("condition"), "order": p.get("order"),
        "bits_game1": (p.get("bits_sequence") or [None, None])[0],
        "bits_game2": (p.get("bits_sequence") or [None, None])[1],
        "condition_source": p.get("condition_source"), "order_source": p.get("order_source"),
        "consent": "yes", "consent_rt_ms": p.get("consent_rt"),
        "total_min": round(p["total_ms"] / 60000, 2) if p.get("total_ms") else None,
        "comprehension_correct": sum(1 for c in comp if c[2] == 1), "comprehension_n": len(comp),
        "n_main_rounds": len(main),
        "final_score": end.get("final_score"), "bonus_pence": end.get("bonus_pence"),
        **{f"click_{k[7:] if k.startswith('clicks_') else k}": v for k, v in end.items()
           if k.startswith("clicks_")},
        **{f"demo_{k}": (", ".join(v) if isinstance(v, list) else v) for k, v in demo.items()},
        "screen": p.get("screen"), "user_agent": p.get("user_agent"), "data_version": p.get("v"),
        "test_rounds": p.get("test_rounds"),
    }

    trials = []
    for r in data["t"]:
        t = dict(zip(data["tcols"], r))
        t["type"] = "practice" if t["type"] == "p" else "main"
        t["removal_order"] = ",".join(DIMS.get(c, c) for c in (t.get("removal_order") or ""))
        trials.append({**ids, "condition": p.get("condition"), "order": p.get("order"), **t})

    qlong = [{**ids, "condition": p.get("condition"), "order": p.get("order"), **dict(zip(data["qcols"], r))}
             for r in data["q"]]
    return part, trials, qlong


def wide_questionnaires(qlong):
    if qlong.empty:
        return qlong
    keys = [c for c in ID_COLS + ["condition", "order"] if c in qlong.columns] + ["game", "bits"]
    w = qlong.pivot_table(index=keys, columns="item", values="value", aggfunc="first").reset_index()
    w.columns.name = None
    has = lambda cols: [c for c in cols if c in w.columns]
    if has(FLOW_ITEMS):
        w["melnikoff_flow_mean"] = w[has(FLOW_ITEMS)].astype(float).mean(axis=1)
    if has(DQ_ITEMS):
        w["dq_sum"] = w[has(DQ_ITEMS)].astype(float).sum(axis=1, min_count=1)
    if has(GEQ_ITEMS):
        w["geq_flow_sum"] = w[has(GEQ_ITEMS)].astype(float).sum(axis=1, min_count=1)
    return w


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", help="Qualtrics export CSV(s), and any curtains_pilot1_*.json files")
    ap.add_argument("--out", default="curtains_pilot1_datasets", help="output folder")
    ap.add_argument("--seed", type=int, default=None, help="seed for P-number order (default: random)")
    args = ap.parse_args()

    parts, trials, qlong, problems = [], [], [], []
    for f in args.files:
        path = Path(f)
        if path.suffix.lower() == ".json":            # manual download after a failed save
            data = json.loads(path.read_text(encoding="utf-8"))
            ids = {"ResponseId": "", "PROLIFIC_PID": "", "STUDY_ID": data["p"].get("study_id") or "",
                   "SESSION_ID": data["p"].get("session_id") or "", "source": path.name}
            a, b, c = tables_for(ids, data)
            parts.append(a); trials += b; qlong += c
            problems.append({"source": path.name, "problem": "from a downloaded file: fill in PROLIFIC_PID from the participant's Prolific message"})
            continue
        df = read_qualtrics(path)
        for _, row in df.iterrows():
            ids = {k: row.get(k, "") for k in ID_COLS}
            ids["source"] = path.name
            consent = row.get("curtains_consent", "")
            if consent == "no":
                parts.append({**ids, "consent": "no"})
                continue
            data, problem = unpack(row)
            if problem:
                status = row.get("curtains_status", "")
                parts.append({**ids, "consent": consent, "problem": problem + (f"; status={status}" if status else "")})
                problems.append({**ids, "problem": problem, "status": status})
                continue
            a, b, c = tables_for(ids, data)
            if row.get("Status", "") == "Survey Preview":
                a["problem"] = "Qualtrics preview, not a participant"
            if data["p"].get("test_rounds"):
                a["problem"] = f"test run ({data['p']['test_rounds']} rounds per game), not a participant"
            parts.append(a); trials += b; qlong += c

    P, T, QL = pd.DataFrame(parts), pd.DataFrame(trials), pd.DataFrame(qlong)
    QW = wide_questionnaires(QL)

    out = Path(args.out)
    (out / "raw").mkdir(parents=True, exist_ok=True)
    (out / "deidentified").mkdir(parents=True, exist_ok=True)
    for name, df in [("participants", P), ("trials", T), ("questionnaires_long", QL), ("questionnaires_wide", QW)]:
        df.to_csv(out / "raw" / f"{name}.csv", index=False)

    # Prolific bulk bonus: "participant_id,amount" per line, amount in pounds, no header.
    if not P.empty and "bonus_pence" in P.columns:
        pay = P[(P.get("consent") == "yes") & P["PROLIFIC_PID"].astype(bool) & (P["bonus_pence"].fillna(0).astype(float) > 0)]
        if "problem" in pay.columns:
            pay = pay[pay["problem"].isna()]
        lines = [f"{pid},{float(p) / 100:.2f}" for pid, p in zip(pay["PROLIFIC_PID"], pay["bonus_pence"])]
        (out / "raw" / "prolific_bonus.csv").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    # De-identified copies: P001, P002, ... in a shuffled order.
    keys = [k for k in P.get("PROLIFIC_PID", pd.Series(dtype=str)).fillna("").tolist()]
    uniq = [k for k in dict.fromkeys(keys) if k]
    rng = random.Random(args.seed)
    rng.shuffle(uniq)
    code = {pid: f"P{i + 1:03d}" for i, pid in enumerate(uniq)}
    pd.DataFrame({"participant": list(code.values()), "PROLIFIC_PID": list(code.keys())}) \
        .sort_values("participant").to_csv(out / "deidentified" / "id_key_KEEP_PRIVATE.csv", index=False)
    drop = ID_COLS + ["source", "user_agent"]
    for name, df in [("participants", P), ("trials", T), ("questionnaires_long", QL), ("questionnaires_wide", QW)]:
        if df.empty:
            df.to_csv(out / "deidentified" / f"{name}.csv", index=False)
            continue
        d = df.copy()
        d.insert(0, "participant", d["PROLIFIC_PID"].map(code) if "PROLIFIC_PID" in d else None)
        d = d.drop(columns=[c for c in drop if c in d.columns])
        d.to_csv(out / "deidentified" / f"{name}.csv", index=False)

    n_data = int(P["n_main_rounds"].notna().sum()) if "n_main_rounds" in P else 0
    n_no = int((P["consent"] == "no").sum()) if "consent" in P else 0
    print(f"Responses read: {len(P)} | with game data: {n_data} | declined consent: {n_no}")
    print(f"Rounds: {len(T)} | questionnaire items: {len(QL)}")
    if problems:
        print("\nCHECK THESE:")
        for pr in problems:
            print("  ", {k: v for k, v in pr.items() if v})
    print(f"\nTables written to {out.resolve()}")
    print("raw/ holds Prolific IDs: keep it in UBC storage. deidentified/id_key_KEEP_PRIVATE.csv must stay private too.")


if __name__ == "__main__":
    sys.exit(main())
