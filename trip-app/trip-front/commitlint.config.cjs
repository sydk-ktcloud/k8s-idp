module.exports = {
  rules: {
    'type-enum': [2, 'always', ['FIX', 'UPDATE', 'ADD', 'FEAT']],
    'type-case': [2, 'always', 'upper-case'],
    'subject-empty': [0], // subject 검사 끔
  },
  parserPreset: {
    parserOpts: {
      headerPattern: /^\[(?<type>FIX|UPDATE|ADD|FEAT)\]\s(?<subject>.+)$/,
      headerCorrespondence: ['type', 'subject'],
    },
  },
};
