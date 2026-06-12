import os

lines = []

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

def mxcell(id_, value, style, **extra):
    attrs = f'id="{id_}" value="{esc(value)}" style="{style}" vertex="1" parent="1"'
    for k, v in extra.items():
        attrs += f' {k.replace("_", "-")}="{v}"'
    lines.append(f'        <mxCell {attrs}>')

def geometry(x, y, w, h):
    lines.append(f'          <mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>')
    lines.append('        </mxCell>')

def edge(eid, src, tgt):
    lines.append(f'        <mxCell id="{eid}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1" source="{src}" target="{tgt}" parent="1">')
    lines.append('          <mxGeometry relative="1" as="geometry"/>')
    lines.append('        </mxCell>')

# ─── header ────────────────────────────────────────────────────────────
lines.append('<?xml version="1.0" encoding="UTF-8"?>')
lines.append('<mxfile host="app.diagrams.net" version="24.0.0">')
lines.append('  <diagram name="Global Use Case Diagram">')
lines.append('    <mxGraphModel dx="0" dy="0" grid="1" gridSize="10" pageWidth="1500" pageHeight="900" math="0" shadow="0">')
lines.append('      <root>')
lines.append('        <mxCell id="0"/>')
lines.append('        <mxCell id="1" parent="0"/>')

# ─── helpers ───────────────────────────────────────────────────────────
def actor(id_, label, x, y, c):
    mxcell(id_, f"<b>&#171;actor&#187;<br/>{label}</b>",
           f"rounded=1;whiteSpace=wrap;html=1;fillColor={c};strokeColor={c};fontSize=11;",
           fontColor="#ffffff")
    geometry(x, y, 110, 44)

def usecase(id_, label, x, y, c):
    mxcell(id_, label,
           f"ellipse;whiteSpace=wrap;html=1;fillColor={c};strokeColor={c};fontSize=10;",
           fontColor="#ffffff")
    geometry(x, y, 170, 30)

# ─── COLORS ────────────────────────────────────────────────────────────
C_VIS = "#94A3B8"
C_STU = "#2563EB"
C_PRO = "#059C69"
C_ADM = "#F97316"
C_SUP = "#7C3AED"

# ─── ACTORS (top row) ────────────────────────────────────────────────
actor("act-vis", "Visitor",       30,  30,  C_VIS)
actor("act-stu", "Student",       200, 30,  C_STU)
actor("act-pro", "Professor",     430, 30,  C_PRO)
actor("act-adm", "Univ. Admin",   670, 30,  C_ADM)
actor("act-sup", "Super Admin",   880, 30,  C_SUP)

# ─── USE CASES ────────────────────────────────────────────────────────
eid = 0

# Visitor (3)
usecase("v1", "Browse Catalog",      20,  130, C_VIS); eid += 1; edge("e"+str(eid), "act-vis", "v1")
usecase("v2", "Register",            20,  180, C_VIS); eid += 1; edge("e"+str(eid), "act-vis", "v2")
usecase("v3", "Login",               20,  230, C_VIS); eid += 1; edge("e"+str(eid), "act-vis", "v3")

# Student (7)
stu = [
    ("s1",  "Browse & Enroll in Courses",   190, 120),
    ("s2",  "Learn (Lessons & QCM)",         190, 170),
    ("s3",  "Ask AI Tutor",                  190, 220),
    ("s4",  "Participate in Discussions",    190, 270),
    ("s5",  "Earn XP, Level Up & Badges",    190, 320),
    ("s6",  "Chat & Friends",                190, 370),
    ("s7",  "View Profile & Analytics",      190, 420),
]
for sid, lbl, x, y in stu:
    usecase(sid, lbl, x, y, C_STU); eid += 1; edge("e"+str(eid), "act-stu", sid)

# Professor (6)
pro = [
    ("p1",  "Create & Manage Courses",       420, 120),
    ("p2",  "Build Curriculum (Sections)",    420, 170),
    ("p3",  "AI Generate Course from PDF",    420, 220),
    ("p4",  "Monitor Enrollments & Feedback", 420, 270),
    ("p5",  "Manage Chat Requests",           420, 320),
    ("p6",  "View Analytics & Profile",       420, 370),
]
for pid, lbl, x, y in pro:
    usecase(pid, lbl, x, y, C_PRO); eid += 1; edge("e"+str(eid), "act-pro", pid)

# University Admin (4)
adm = [
    ("a1",  "Review Professor Join Requests", 660, 120),
    ("a2",  "Moderate Discussions & Content", 660, 170),
    ("a3",  "Post University Announcements",  660, 220),
    ("a4",  "View University Statistics",     660, 270),
]
for aid, lbl, x, y in adm:
    usecase(aid, lbl, x, y, C_ADM); eid += 1; edge("e"+str(eid), "act-adm", aid)

# Super Admin (4)
sup = [
    ("sa1", "Manage Regions & Universities",  870, 120),
    ("sa2", "Create Univ. Admin Accounts",    870, 170),
    ("sa3", "Ban / Unban Any User",           870, 220),
    ("sa4", "Platform-wide Oversight",        870, 270),
]
for sid, lbl, x, y in sup:
    usecase(sid, lbl, x, y, C_SUP); eid += 1; edge("e"+str(eid), "act-sup", sid)

lines.append('      </root>')
lines.append('    </mxGraphModel>')
lines.append('  </diagram>')
lines.append('</mxfile>')

out = "\n".join(lines) + "\n"
path = os.path.join("docs", "Hub4Learners_Global_Use_Case_Diagram.drawio")
with open(path, "w", encoding="UTF-8") as f:
    f.write(out)
print(f"[OK] Saved: {path}")
