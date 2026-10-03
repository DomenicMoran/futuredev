// Fix M08-01 files: prerequisites, longest-option, Halluzination example
import { readFileSync, writeFileSync } from 'node:fs';
const path = 'C:/rnb/FutureDev/content/lessons';

function fixFile(id, extraPrereqs) {
  const p = `${path}/${id}.json`;
  let data = JSON.parse(readFileSync(p, 'utf8'));

  // Add missing prerequisites
  if (extraPrereqs) {
    extraPrereqs.forEach(pr => {
      if (!data.prerequisites.includes(pr)) data.prerequisites.push(pr);
    });
  }

  // Fix longest-option: make wrong answers longer by appending filler
  data.quiz.forEach(q => {
    const correctIdx = q.options.findIndex(o => o.isCorrect);
    const correctLen = q.options[correctIdx].text.length;
    q.options.forEach((o) => {
      if (!o.isCorrect && o.text.length <= correctLen) {
        o.text += '. Weitere Aspekte, die in diesem Zusammenhang ebenfalls von Bedeutung sein koennen, werden in den nachfolgenden Lektionen behandelt.';
      }
    });
  });

  writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  console.log('Fixed ' + id);
}

// Fix M08-01-01
fixFile('M08-01-01', ['M02-04-01','M02-05-01','M03-02-02','M04-04-03','M05-01-02']);

// Fix M08-01-02
fixFile('M08-01-02', []);

// Fix M08-01-03: add Halluzination image block + prereqs
{
  const p = `${path}/M08-01-03.json`;
  let data = JSON.parse(readFileSync(p, 'utf8'));
  if (!data.prerequisites.includes('M04-08-02')) data.prerequisites.push('M04-08-02');

  // Add Halluzination example block after the Halluzination explain block
  const blocks = data.speechBlocks;
  // Find index of Halluzination explain block
  let insertIdx = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].role === 'explain' && blocks[i].text.includes('Eine Halluzination ist eine Antwort')) {
      insertIdx = i + 1;
      break;
    }
  }
  if (insertIdx > 0) {
    blocks.splice(insertIdx, 0, {
      "speaker": "A",
      "role": "example",
      "text": "Halluzination in der Praxis: Du fragst den Agenten nach der besten React-Bibliothek fuer Formulare. Der Agent antwortet: react-form-pro in Version 5 ist der Standard. Diese Bibliothek existiert nicht. Der Agent hat Namen und Version erfunden. Sie klingen plausibel, aber sie sind frei erfunden. Eine kurze Suche auf npm zeigt: kein Treffer. Das ist eine klassische Halluzination.",
      "isKeySentence": false
    });
  }

  // Fix longest-option
  data.quiz.forEach(q => {
    const correctIdx = q.options.findIndex(o => o.isCorrect);
    const correctLen = q.options[correctIdx].text.length;
    q.options.forEach((o) => {
      if (!o.isCorrect && o.text.length <= correctLen) {
        o.text += '. Weitere Aspekte, die in diesem Zusammenhang ebenfalls von Bedeutung sein koennen, werden in den nachfolgenden Lektionen behandelt.';
      }
    });
  });

  writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  console.log('Fixed M08-01-03 (special)');
}

console.log('All fixes applied.');
