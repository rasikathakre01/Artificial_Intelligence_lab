"""
Explainable AI for IT Decision Support — v3.0
Flask Backend | scikit-learn Decision Tree | Custom SHAP Attribution
"""

from flask import Flask, render_template, request, jsonify
import numpy as np
from sklearn.tree import DecisionTreeClassifier

app = Flask(__name__)

TRAINING_DATA = np.array([
    [0,0,2,0,2],[0,0,1,0,2],[0,0,2,1,2],[1,0,2,0,2],[1,0,2,1,2],[0,1,2,0,2],
    [0,0,1,1,2],[1,1,2,0,2],[0,0,2,2,1],[1,1,1,1,1],[2,1,2,1,1],[1,2,2,1,1],
    [2,1,1,1,1],[1,1,1,2,1],[2,0,1,2,1],[2,1,2,2,1],[0,2,1,2,1],[1,2,2,0,1],
    [2,2,0,2,0],[2,2,1,2,0],[1,2,0,2,0],[2,2,2,2,0],[0,2,0,2,0],[2,2,0,1,0],
    [1,2,0,1,0],[2,1,0,2,0],[0,2,0,0,0],[1,0,0,2,0],[2,0,0,2,0],[0,1,0,2,0],
])

X_train = TRAINING_DATA[:,:4].astype(float)
y_train = TRAINING_DATA[:,4]

FEATURE_NAMES = ["Budget","Risk Level","Expected Profit","Duration"]
LABEL_NAMES   = ["Reject","Review","Approve"]
CAT_NAMES     = {0:"Low",1:"Medium",2:"High"}
DUR_NAMES     = {0:"Short",1:"Medium",2:"Long"}

DT = DecisionTreeClassifier(max_depth=4, random_state=42, min_samples_leaf=2)
DT.fit(X_train, y_train)

def convert_budget(v):   return 0 if v<300000  else (1 if v<700000 else 2)
def convert_risk(v):     return 0 if v<=3      else (1 if v<=6     else 2)
def convert_profit(v):   return 0 if v<20      else (1 if v<50     else 2)
def convert_duration(v): return 0 if v<=6      else (1 if v<=12    else 2)

def compute_shap(x_row, n_samples=300):
    x_row  = np.array(x_row, dtype=float)
    n_feat = len(x_row)
    rng    = np.random.RandomState(42)
    phi    = np.zeros(n_feat)
    for _ in range(n_samples):
        perm      = rng.permutation(n_feat)
        bg_row    = X_train[rng.randint(0, len(X_train))].copy()
        x_current = bg_row.copy()
        for feat in perm:
            x_without       = x_current.copy()
            x_current[feat] = x_row[feat]
            phi[feat]      += float(DT.predict([x_current])[0]) - float(DT.predict([x_without])[0])
    phi /= n_samples
    total = np.sum(np.abs(phi))
    return (phi/total).tolist() if total>0 else phi.tolist()

def get_decision_path(x_row):
    node_ids = DT.decision_path(np.array([x_row],dtype=float)).indices
    tree     = DT.tree_
    steps    = []
    for depth_idx, node_id in enumerate(node_ids):
        feat_idx = tree.feature[node_id]
        if feat_idx < 0:
            leaf_vals = tree.value[node_id][0]
            steps.append({"type":"leaf","feature":"Final Decision",
                          "condition":LABEL_NAMES[int(np.argmax(leaf_vals))],
                          "passed":True,"depth":depth_idx,"samples":int(tree.n_node_samples[node_id])})
            continue
        threshold = tree.threshold[node_id]
        feat_val  = x_row[feat_idx]
        passed    = feat_val <= threshold
        label_map = DUR_NAMES if feat_idx==3 else CAT_NAMES
        thresh_lbl= label_map.get(int(round(threshold)), f"{threshold:.1f}")
        val_lbl   = label_map.get(int(feat_val), str(int(feat_val)))
        steps.append({"type":"node","feature":FEATURE_NAMES[feat_idx],
                      "condition":f"≤ {thresh_lbl}  (your input: {val_lbl})",
                      "passed":bool(passed),"depth":depth_idx,"samples":int(tree.n_node_samples[node_id])})
    return steps

def build_explanation(label, shap_norm, raw, cats):
    decision = LABEL_NAMES[label]
    top_i    = max(range(4), key=lambda i: abs(shap_norm[i]))
    top_feat = FEATURE_NAMES[top_i]
    dirn     = "positively" if shap_norm[top_i]>0 else "negatively"
    conv     = (f"Inputs converted → Budget:{CAT_NAMES[cats[0]]} | Risk:{CAT_NAMES[cats[1]]} | "
                f"Profit:{CAT_NAMES[cats[2]]} | Duration:{DUR_NAMES[cats[3]]}. ")
    if decision=="Approve":
        body=(f"The project is recommended for APPROVAL. {top_feat} {dirn} influenced this decision most. "
              f"Budget ${raw['budget']:,.0f}, risk {raw['risk']}/10, profit {raw['profit']}% over "
              f"{raw['duration']} months presents a viable IT investment profile.")
    elif decision=="Review":
        body=(f"The project requires further REVIEW. {top_feat} {dirn} influenced this decision most. "
              f"Mixed signals: {raw['profit']}% profit vs {raw['risk']}/10 risk with ${raw['budget']:,.0f} "
              f"budget over {raw['duration']} months creates borderline viability.")
    else:
        body=(f"The project is REJECTED. {top_feat} {dirn} influenced this decision most. "
              f"Risk {raw['risk']}/10 combined with {raw['profit']}% profit and ${raw['budget']:,.0f} "
              f"budget over {raw['duration']} months makes this non-viable.")
    return conv+body

@app.route("/")
def index(): return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    try:
        body     = request.get_json()
        budget   = float(body["budget"])
        risk     = float(body["risk"])
        profit   = float(body["profit"])
        duration = float(body["duration"])
        errors   = []
        if not(1<=budget<=10_000_000):  errors.append("Budget must be $1–$10,000,000")
        if not(1<=risk<=10):            errors.append("Risk must be 1–10")
        if not(0<=profit<=500):         errors.append("Profit must be 0–500%")
        if not(1<=duration<=120):       errors.append("Duration must be 1–120 months")
        if errors: return jsonify({"success":False,"error":"; ".join(errors)}),400
        b_cat=convert_budget(budget); r_cat=convert_risk(risk)
        p_cat=convert_profit(profit); d_cat=convert_duration(duration)
        x_row=[b_cat,r_cat,p_cat,d_cat]
        label=int(DT.predict([x_row])[0])
        proba=DT.predict_proba([x_row])[0].tolist()
        shap_norm=compute_shap(x_row)
        path=get_decision_path(x_row)
        raw_inputs={"budget":budget,"risk":risk,"profit":profit,"duration":duration}
        explanation=build_explanation(label,shap_norm,raw_inputs,[b_cat,r_cat,p_cat,d_cat])
        return jsonify({
            "success":True,"decision":LABEL_NAMES[label],"label_index":label,
            "confidence":round(max(proba)*100,1),
            "probabilities":{"Reject":round(proba[0]*100,1),"Review":round(proba[1]*100,1),"Approve":round(proba[2]*100,1)},
            "explanation":explanation,"path":path,
            "shap":[{"feature":FEATURE_NAMES[i],"value":round(shap_norm[i],4)} for i in range(4)],
            "conversion":{
                "budget":  {"raw":f"${budget:,.0f}","category":CAT_NAMES[b_cat],"rule":"< $300k=Low | $300k–$700k=Medium | ≥$700k=High"},
                "risk":    {"raw":f"{risk}/10","category":CAT_NAMES[r_cat],"rule":"1–3=Low | 4–6=Medium | 7–10=High"},
                "profit":  {"raw":f"{profit}%","category":CAT_NAMES[p_cat],"rule":"<20%=Low | 20–49%=Medium | ≥50%=High"},
                "duration":{"raw":f"{int(duration)} months","category":DUR_NAMES[d_cat],"rule":"≤6mo=Short | 7–12mo=Medium | >12mo=Long"},
            }
        })
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}),500

if __name__=="__main__":
    acc=DT.score(X_train,y_train)
    print(f"\n  XAI · IT Decision Support v3.0 | DecisionTree accuracy={acc*100:.0f}%")
    print(f"  http://127.0.0.1:5000\n")
    app.run(debug=True, port=5000)
