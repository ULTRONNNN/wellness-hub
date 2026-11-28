// Demonstration-only knowledge base; not clinically validated.
export const documents = [
  { title: 'Emergency symptoms', specialty: 'Emergency Medicine', text: 'Sudden severe chest pain, severe difficulty breathing, new weakness on one side, sudden confusion, uncontrolled bleeding, or loss of consciousness require immediate emergency evaluation. Call local emergency services.' },
  { title: 'Fever basics', specialty: 'General Medicine', text: 'Fever may accompany many illnesses. Rest and adequate fluids may help. Seek medical assessment for persistent fever, dehydration, significant worsening, or fever with concerning symptoms. Infants with fever need prompt professional assessment.' },
  { title: 'Headaches', specialty: 'Neurology', text: 'Headaches can have many causes. A sudden worst-ever headache, headache with new neurological symptoms, or headache with stiff neck and fever needs urgent assessment.' },
  { title: 'Skin concerns', specialty: 'Dermatology', text: 'Skin rashes may have infectious, allergic, or inflammatory causes. Rapidly spreading rash with fever, swelling of lips or tongue, or breathing problems requires urgent evaluation.' },
  { title: 'Digestive discomfort', specialty: 'Gastroenterology', text: 'Stomach discomfort has many causes. Severe or worsening abdominal pain, vomiting blood, black stools, or signs of dehydration require prompt medical attention.' },
  { title: 'Heart symptoms', specialty: 'Cardiology', text: 'Palpitations and chest discomfort should be assessed based on context. Chest pressure with breathlessness, sweating, or fainting requires emergency care.' },
  { title: 'Respiratory symptoms', specialty: 'Pulmonology', text: 'Cough may have many causes. Severe breathing difficulty, blue lips, or confusion are emergency warning signs.' },
  { title: 'Mental wellbeing', specialty: 'Psychiatry', text: 'Stress, anxiety, and low mood can benefit from supportive care and professional evaluation. If someone may harm themselves, seek immediate local emergency or crisis support.' },
  { title: 'Blood sugar reports', specialty: 'Endocrinology', text: 'Blood glucose and HbA1c results require interpretation in context, including test type and fasting status. A qualified clinician can assess abnormal results.' },
  { title: 'Blood count reports', specialty: 'General Medicine', text: 'Hemoglobin and other blood count results should be interpreted using the laboratory reference ranges and clinical context. Abnormal results may require further assessment.' }
];
const stop = new Set('with that this have from about what when your there some could would should please explain tell help need want know many cause causes may can the and for are how does information assessment professional care require requires symptoms'.split(' '));
const normalize = value => String(value ?? '').toLowerCase().replace(/[’‘]/g, "'");
const tokens = value => new Set((normalize(value).match(/[a-z][a-z0-9]{2,}/g) || []).filter(w => !stop.has(w)));
const medical = /\b(?:fever|headaches?|migraine|skin|rash|acne|itching|stomach|abdominal|nausea|vomiting|digestive|heart|chest|palpitations?|cough|asthma|breathing|breathlessness|lungs?|anxiety|depression|stress|suicide|stroke|bleeding|hemoglobin|haemoglobin|anemia|anaemia|glucose|hba1c|diabetes|thyroid|cholesterol|kidney|medical|blood)\b/i;
export function retrieve(query, k = 3) {
  if (!medical.test(normalize(query))) return [];
  const q = tokens(query);
  return documents.map(doc => {
    const words = tokens(`${doc.title} ${doc.specialty} ${doc.text}`);
    const title = tokens(doc.title);
    const score = [...q].reduce((n,t) => n + (words.has(t) ? 1 : 0) + (title.has(t) ? 2 : 0), 0);
    return { ...doc, score };
  }).filter(d => d.score > 0).sort((a,b) => b.score-a.score).slice(0, Math.max(0, Math.min(8, Number(k) || 0)));
}
// Conservative fast-path only. The AI must still assess ambiguous symptoms.
export function emergencyFlag(text) {
  const t = normalize(text).trim();
  const urgent = /\b(?:chest pain|chest pressure|can't breathe|cannot breathe|difficulty breathing|severe breathlessness|unconscious|fainting|stroke|one[- ]side(?:d)? weakness|suicid\w*|self[- ]harm|severe bleeding|uncontrolled bleeding|worst(?: ever)? headache|blue lips|kill myself|end my life|overdose)\b/i;
  if (!urgent.test(t)) return false;
  const personal = /\b(?:i|i'm|i've|my|me|we|our|he|she|they|someone|patient|friend|mother|father|child|brother|sister)\b/i;
  const educational = /^(?:what (?:is|are|causes|does)|define|explain|describe|write|create|compare|give (?:me )?(?:a definition|examples|information)|how (?:does|do you define))\b/i;
  // Never suppress an emergency solely because the message also asks a question.
  if (educational.test(t) && !personal.test(t)) return false;
  return true;
}
export function specialtyFor(text) {
  const t = normalize(text);
  if (/\b(?:chest|heart|palpitations?|cardiology)\b/.test(t)) return 'Cardiology';
  if (/\b(?:skin|rash|acne|itching|dermatology)\b/.test(t)) return 'Dermatology';
  if (/\b(?:headaches?|migraine|seizures?|dizzy|dizziness|neurology)\b/.test(t)) return 'Neurology';
  if (/\b(?:stomach|digestive|digestion|nausea|abdominal|gastroenterology)\b/.test(t)) return 'Gastroenterology';
  if (/\b(?:cough|asthma|breathing|breathlessness|lungs?|pulmonology)\b/.test(t)) return 'Pulmonology';
  if (/\b(?:anxiety|depression|depressed|stress|mood|psychiatry)\b/.test(t)) return 'Psychiatry';
  if (/\b(?:diabetes|glucose|hba1c|thyroid|endocrinology)\b/.test(t)) return 'Endocrinology';
  return 'General Medicine';
}