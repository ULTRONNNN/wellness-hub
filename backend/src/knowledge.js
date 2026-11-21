// Demonstration-only knowledge base. Replace with clinician-approved sources for real use.
export const documents = [
  { title: 'Emergency symptoms', specialty: 'Emergency Medicine', text: 'Sudden severe chest pain, severe difficulty breathing, new weakness on one side, sudden confusion, uncontrolled bleeding, or loss of consciousness require immediate emergency evaluation. Call local emergency services.' },
  { title: 'Fever basics', specialty: 'General Medicine', text: 'Fever may accompany many illnesses. Rest and adequate fluids may help. Seek medical assessment for persistent fever, dehydration, significant worsening, or fever with concerning symptoms. Infants with fever need prompt professional assessment.' },
  { title: 'Headaches', specialty: 'Neurology', text: 'Headaches can have many causes. A sudden worst-ever headache, headache with new neurological symptoms, or headache with stiff neck and fever needs urgent assessment.' },
  { title: 'Skin concerns', specialty: 'Dermatology', text: 'Skin rashes may have infectious, allergic, or inflammatory causes. Rapidly spreading rash with fever, swelling of lips or tongue, or breathing problems requires urgent evaluation.' },
  { title: 'Digestive discomfort', specialty: 'Gastroenterology', text: 'Stomach discomfort has many causes. Severe or worsening abdominal pain, vomiting blood, black stools, or signs of dehydration require prompt medical attention.' },
  { title: 'Heart symptoms', specialty: 'Cardiology', text: 'Palpitations and chest discomfort should be assessed based on context. Chest pressure with breathlessness, sweating, or fainting requires emergency care.' },
  { title: 'Respiratory symptoms', specialty: 'Pulmonology', text: 'Cough may have many causes. Severe breathing difficulty, blue lips, or confusion are emergency warning signs.' },
  { title: 'Mental wellbeing', specialty: 'Psychiatry', text: 'Stress, anxiety, and low mood can benefit from supportive care and professional evaluation. If someone may harm themselves, seek immediate local emergency or crisis support.' }
];
const tokens = s => new Set((s.toLowerCase().match(/[a-z]{3,}/g) || []).filter(w => !['with','that','this','have','from','about','what','when','your','there','some','could'].includes(w)));
export function retrieve(query, k=3) {
  const q = tokens(query);
  return documents.map(doc => {
    const words = tokens(`${doc.title} ${doc.specialty} ${doc.text}`);
    const score = [...q].filter(t => words.has(t)).length;
    return { ...doc, score };
  }).filter(d => d.score > 0).sort((a,b) => b.score-a.score).slice(0,k);
}
export function emergencyFlag(text) {
  return /(?:chest pain|can't breathe|cannot breathe|difficulty breathing|severe breathlessness|unconscious|fainting|stroke|one.side weakness|suicid|self.harm|severe bleeding|worst headache|blue lips)/i.test(text);
}
export function specialtyFor(text) {
  const t = text.toLowerCase();
  if (/chest|heart|palpitation/.test(t)) return 'Cardiology';
  if (/skin|rash|acne|itch/.test(t)) return 'Dermatology';
  if (/headache|migraine|seizure|dizzy/.test(t)) return 'Neurology';
  if (/stomach|digest|nausea|abdominal/.test(t)) return 'Gastroenterology';
  if (/cough|asthma|breath|lung/.test(t)) return 'Pulmonology';
  if (/anxiety|depress|stress|mood/.test(t)) return 'Psychiatry';
  return 'General Medicine';
}
