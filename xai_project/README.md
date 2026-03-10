# Explainable AI for IT Decision Support
### Flask + Decision Tree + SHAP Simulation

## Project Structure

```
xai_project/
├── app.py                  ← Flask backend (Decision Tree + SHAP logic)
├── requirements.txt        ← Python dependencies
├── README.md
├── templates/
│   └── index.html          ← Main webpage template
└── static/
    ├── css/
    │   └── style.css       ← Dashboard stylesheet
    └── js/
        └── main.js         ← Frontend logic & API calls
```

## Quick Start

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the Flask server

```bash
python app.py
```

### 3. Open your browser

Navigate to: **http://127.0.0.1:5000**

---

## How It Works

### AI Pipeline
1. **User Input** — Enter Budget, Risk Level, Expected Profit, Project Duration
2. **Decision Tree** — Traverses learned branches to reach a classification
3. **Rule-Based Validation** — Domain logic checks validate the result
4. **SHAP Attribution** — Shapley values measure each feature's contribution
5. **Output** — Decision (Approve / Review / Reject) + full explanation

### Decisions
| Decision | Meaning |
|----------|---------|
| **Approve** | Project is financially viable and operationally safe |
| **Review** | Borderline case — further evaluation recommended |
| **Reject** | Too risky or not financially viable |

### SHAP Values
- **Positive (green)** — feature pushed the decision toward Approve
- **Negative (red)** — feature pushed the decision toward Reject
- Bar length represents relative importance

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python + Flask |
| AI Model | Decision Tree (custom implementation) |
| Explainability | SHAP-style feature attribution |
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Fonts | Syne, DM Sans, JetBrains Mono |

---

## Notes

- The Decision Tree and SHAP logic are fully implemented in pure Python + NumPy — **no sklearn or shap package required** for running the demo.
- If you wish to extend with real sklearn/shap, install: `pip install scikit-learn shap`
- The model is trained on 24 labeled IT project scenarios.

---

*Student AI Project · 2026*
