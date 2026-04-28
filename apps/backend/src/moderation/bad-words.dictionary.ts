export type BadWordRule = {
  value: string;
  severity: number;
  category: 'insult' | 'harassment' | 'threat' | 'hate' | 'spam';
};

export const BAD_WORD_RULES: BadWordRule[] = [
  { value: 'bad word', severity: 50, category: 'insult' },
  { value: 'bad words', severity: 50, category: 'insult' },
  { value: 'badword', severity: 50, category: 'insult' },
  { value: 'idiot', severity: 50, category: 'insult' },
  { value: 'stupid', severity: 50, category: 'insult' },
  { value: 'shut up', severity: 50, category: 'harassment' },
  { value: 'fuck you', severity: 80, category: 'harassment' },
  { value: 'kill yourself', severity: 350, category: 'threat' },
  { value: 'i will kill you', severity: 400, category: 'threat' },
  { value: 'go die', severity: 250, category: 'harassment' },
  { value: 'spam spam spam', severity: 80, category: 'spam' },
  { value: 'sale arabe', severity: 200, category: 'harassment'},
];
