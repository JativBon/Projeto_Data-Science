import subprocess
import sys
from pathlib import Path

PYTHON = sys.executable
ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
RAW_DIR = ROOT / "data" / "raw"
CSV_DIR = ROOT / "data" / "csv"
PROCESSED_DIR = ROOT / "data" / "processed"
PNG_DIR = ROOT / "assets" / "png"

# Configuração reduzida apenas às excepções/ficheiros de origem
DATASETS_BASE = {
    "01": {"raw": RAW_DIR / "dataset 01.txt", "prep": SCRIPTS_DIR / "01_dataset.py", "seq": PROCESSED_DIR / "sequencias_dataset01_limpo.txt"},
    "02": {"raw": RAW_DIR / "dataset 02.txt", "prep": SCRIPTS_DIR / "02_dataset.py", "seq": PROCESSED_DIR / "sequencias_dataset02_limpo.txt"},
    "03": {"raw": RAW_DIR / "dataset 03.xlsx", "prep": SCRIPTS_DIR / "03_dataset.py", "seq": PROCESSED_DIR / "sequencias_dataset03.txt"},
}

def get_files(ds_id: str, cfg: dict) -> dict[str, str]:
    """Gera dinamicamente os caminhos e nomes de ficheiros padronizados."""
    return {
        "raw": cfg["raw"],
        "prep": cfg["prep"],
        "seq": cfg["seq"],
        "pairs": CSV_DIR / f"pares_frequencias_dataset{ds_id}.csv",
        "matrix": CSV_DIR / f"matriz_adjacencia_dataset{ds_id}.csv",
        "graph": PNG_DIR / f"grafo_dataset{ds_id}.png",
        "edges": CSV_DIR / f"grafo_edges_dataset{ds_id}.csv",
        "ramex_csv": CSV_DIR / f"ramex_dataset{ds_id}.csv",
        "ramex_png": PNG_DIR / f"ramex_dataset{ds_id}.png",
    }

def run_command(title: str, cmd: list[str], required: list[str]) -> bool:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")
    
    if missing := [f for f in required if not Path(f).exists()]:
        print("\nAviso: ficheiros necessarios em falta:\n" + "\n".join(f"- {f}" for f in missing))
        print("A fase nao foi executada.\n")
        return False

    print(f"Comando: {' '.join(str(part) for part in cmd)}")
    sys.stdout.flush()
    
    if subprocess.run([str(part) for part in cmd], cwd=ROOT).returncode != 0:
        print("\nErro: a fase falhou.\n")
        return False

    print("Fase concluida com sucesso.")
    return True

def run_step(step_name: str, script_key: str, arg_keys: list[str], req_keys: list[str]) -> bool:
    """Executa genericamente uma fase da pipeline iterando pelos datasets."""
    success = True
    for ds_id, cfg in DATASETS_BASE.items():
        files = get_files(ds_id, cfg)
        script = files[script_key] if script_key in files else SCRIPTS_DIR / script_key
        cmd = [PYTHON, script] + [files[k] for k in arg_keys]
        reqs = [script] + [files[k] for k in req_keys]
            
        success = run_command(f"{step_name} - Dataset {ds_id}", cmd, reqs) and success
    return success

# Funções delegadas para cada fase da pipeline
def run_prep(): return run_step("Preparacao", "prep", [], ["raw"])
def run_pairs(): return run_step("Geracao de pares", "04_pairs.py", ["seq", "pairs"], ["seq"])
def run_matrix(): return run_step("Geracao de matrizes", "05_matriz_adjacencia.py", ["pairs", "matrix"], ["pairs"])
def run_graphs(): return run_step("Geracao de grafos", "06_grafo.py", ["matrix", "graph"], ["matrix"])
def run_ramex(): return run_step("Geracao RAMEX", "07_ramex_simplificado.py", ["edges", "ramex_csv", "ramex_png"], ["edges"])

def run_validation() -> bool:
    reqs = [SCRIPTS_DIR / "08_validacao_comparativa.py"]
    for ds_id, cfg in DATASETS_BASE.items():
        files = get_files(ds_id, cfg)
        reqs.extend([files["edges"], files["ramex_csv"]])
    return run_command("Validacao comparativa final", [PYTHON, SCRIPTS_DIR / "08_validacao_comparativa.py"], reqs)

STEPS = [
    ("Executar preparacao dos datasets", run_prep),
    ("Gerar pares/frequencias", run_pairs),
    ("Gerar matrizes de adjacencia", run_matrix),
    ("Gerar grafos", run_graphs),
    ("Gerar RAMEX simplificado", run_ramex),
    ("Executar validacao comparativa", run_validation),
]

def run_all() -> bool:
    print("\nPipeline completa iniciada.")
    for directory in [CSV_DIR, PROCESSED_DIR, PNG_DIR]:
        directory.mkdir(parents=True, exist_ok=True)
    for name, func in STEPS:
        if not func():
            print(f"\nPipeline interrompida: falha na fase '{name}'.")
            return False
    print("\nFramework executada com sucesso. Consulte os ficheiros gerados.")
    return True

def main() -> int:
    while True:
        print(f"\n{'=' * 70}\nFRAMEWORK ACADEMICA DE ANALISE SEQUENCIAL - RAMEX SIMPLIFICADO\n{'=' * 70}")
        for i, (name, _) in enumerate(STEPS, 1):
            print(f"{i}. {name}")
        print(f"{len(STEPS) + 1}. Executar pipeline completa\n0. Sair")
        
        opt = input("Escolha uma opcao: ").strip()
        if opt == "0":
            print("A sair da framework.")
            return 0
        if opt == str(len(STEPS) + 1):
            run_all()
        elif opt.isdigit() and 1 <= int(opt) <= len(STEPS):
            STEPS[int(opt) - 1][1]()
        else:
            print("Opcao invalida. Tente novamente.")

if __name__ == "__main__":
    sys.exit(main())
