const fs = require('fs');
const path = require('path');

class CongestionPredictor {
    constructor() {
        this.weightsPath = path.join(__dirname, '../data/model_weights.json');
        this.historyPath = path.join(__dirname, '../data/eta_history.json');
        this.weights = this.loadWeights();
    }

    loadWeights() {
        try {
            if (fs.existsSync(this.weightsPath)) return JSON.parse(fs.readFileSync(this.weightsPath, 'utf8'));
        } catch (e) { console.error('[CongestionPredictor] Error loading weights:', e); }
        return null;
    }

    /**
     * FASE 1: Reglas Heurísticas (Startup Phase)
     * Basado en conocimiento experto del tráfico de Cartagena
     */
    predictPhase1(routeId, context) {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        let score = 0;

        // 1. Factores Horarios (Picos en Cartagena)
        if ((hour >= 6 && hour <= 8) || (hour >= 17 && hour <= 19)) score += 0.4;
        else if (hour >= 8 && hour <= 17) score += 0.2;

        // 2. Factores de Día
        if (day >= 1 && day <= 5) score += 0.2; // Día hábil

        // 3. Alertas en Tiempo Real
        if (context.activeAlerts) score += context.activeAlerts * 0.15;
        if (context.busFullReports) score += context.busFullReports * 0.1;

        return Math.min(1.0, score);
    }

    /**
     * FASE 3: Regresión Lineal Múltiple (Cálculo Matricial Puro)
     * Implementación de Mínimos Cuadrados Ordinarios (OLS)
     */
    
    // Multiplicación de matrices: A(MxN) * B(NxP) = C(MxP)
    matMul(A, B) {
        const M = A.length, N = A[0].length, P = B[0].length;
        const C = Array.from({ length: M }, () => Array(P).fill(0));
        for (let i = 0; i < M; i++) {
            for (let j = 0; j < P; j++) {
                for (let k = 0; k < N; k++) {
                    C[i][j] += A[i][k] * B[k][j];
                }
            }
        }
        return C;
    }

    // Transpuesta de matriz: M(MxN) -> MT(NxM)
    transpose(M) {
        return M[0].map((_, colIndex) => M.map(row => row[colIndex]));
    }

    // Inversión de matriz por eliminación Gauss-Jordan con pivoteo
    invertMatrix(M) {
        const n = M.length;
        const A = M.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))]);

        for (let i = 0; i < n; i++) {
            // Pivoteo parcial para estabilidad numérica
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
            }
            [A[i], A[maxRow]] = [A[maxRow], A[i]];

            const pivot = A[i][i];
            if (Math.abs(pivot) < 1e-10) throw new Error("Matriz singular: determinante cero");

            for (let j = i; j < 2 * n; j++) A[i][j] /= pivot;
            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    const factor = A[k][i];
                    for (let j = i; j < 2 * n; j++) A[k][j] -= factor * A[i][j];
                }
            }
        }
        return A.map(row => row.slice(n));
    }

    /**
     * Entrenamiento: Beta = (XT * X)^-1 * XT * y
     * Resuelve los pesos óptimos para minimizar el error cuadrático
     */
    trainModel(samples) {
        const X = samples.map(s => s.features);
        const y = samples.map(s => [s.target]);

        const XT = this.transpose(X);
        const XTX = this.matMul(XT, X);
        const XTX_inv = this.invertMatrix(XTX);
        const XT_y = this.matMul(XT, y);
        const beta = this.matMul(XTX_inv, XT_y);

        this.weights = beta.flat();
        fs.writeFileSync(this.weightsPath, JSON.stringify(this.weights));
        return this.weights;
    }

    getLabel(score) {
        if (score <= 0.3) return { label: "fluido", color: "#22c55e", emoji: "🟢" };
        if (score <= 0.6) return { label: "moderado", color: "#eab308", emoji: "🟡" };
        if (score <= 0.8) return { label: "congestionado", color: "#f97316", emoji: "🟠" };
        return { label: "crítico", color: "#ef4444", emoji: "🔴" };
    }
}

module.exports = new CongestionPredictor();
