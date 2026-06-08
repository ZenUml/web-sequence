// Conformance corpus for the semantic non-conflict gate (docs/adr/0002).
//
// The gate asserts: for every input, OUR parser's participant set is a SUBSET of
// ANTLR's. POSITIVE cases are well-formed shapes we want to understand. NEGATIVE
// cases are the heart of the gate — inputs that TEMPT a naive parser to FABRICATE
// participants ANTLR never claims (message labels, message targets read as decls,
// half-typed lines, garbage). Abstaining (knowing fewer) passes; fabricating fails.
//
// Adding cases needs NO oracle regen — the committed bundle computes ANTLR's set
// live for any input.

export interface CorpusCase {
  /** Stable, human-readable id for the test title. */
  name: string
  /** The DSL source fed to both parsers. */
  src: string
  /** Why this case exists — especially the trap a negative case sets. */
  note?: string
  /**
   * RED marker: our parser CURRENTLY fabricates on this input (Head-greedy bug).
   * The gate runs these under `it.fails` so the committed suite stays green while
   * recording the known defect. The GREEN phase makes the parser abstain and
   * MUST delete this flag from every case (docs/adr/0002). `it.fails` self-enforces
   * removal: once the case genuinely passes, `it.fails` starts failing.
   */
  expectedFabrication?: boolean
}

// ── POSITIVE: well-formed shapes ────────────────────────────────────────────
export const POSITIVE: CorpusCase[] = [
  { name: 'empty document', src: '' },
  { name: 'comment only', src: '// just a note' },
  { name: 'single annotated participant', src: '@Actor Client' },
  { name: 'bare participant', src: 'Client' },
  { name: 'two annotated participants', src: '@Actor Client\n@Boundary OrderController' },
  { name: 'participant with stereotype', src: '@Actor <<service>> Client' },
  { name: 'participant with color', src: '@Actor Client #FFEBE6' },
  { name: 'participant with width', src: '@Actor Client 100' },
  { name: 'group block', src: 'group {\n@Service PurchaseService\n}' },
  { name: 'named group', src: 'group Payments {\n@Service Charge\n}' },
  { name: 'empty named group', src: 'group myGroup {\n}' },
  { name: 'lone async message', src: 'A->B: Hello' },
  { name: 'lone async no colon', src: 'A->B' },
  { name: 'lone sync call', src: 'A.method()' },
  { name: 'assignment sync', src: 'x = A.method()' },
  { name: 'creation', src: 'a = new A()' },
  { name: 'if block', src: 'if (cond) {\n  A.b()\n}' },
  { name: 'while block', src: 'while (cond) {\n  A.b()\n}' },
  { name: 'try/catch', src: 'try {\n  A.b()\n} catch (e) {\n  C.d()\n}' },
  { name: 'title then message', src: 'title Demo\nA->B: hi' },
  { name: 'sync with nested body', src: 'A.run() {\n  B.work()\n}' },
]

// ── NEGATIVE: fabrication traps (the centerpiece) ───────────────────────────
export const NEGATIVE: CorpusCase[] = [
  {
    name: 'HEADLINE: declare then async message',
    src: '@Actor Alice\nAlice->Bob: Hello',
    note: 'Head-greedy bug: must NOT fabricate "Hello" (a message label) as a participant. ANTLR = {Alice,Bob}.',
  },
  {
    name: 'declare then sync call',
    src: '@Actor Alice\nAlice.method()',
    note: 'Must not fabricate "method" as a participant. ANTLR = {Alice}.',
  },
  {
    name: 'two declares then message',
    src: '@Actor A\n@Boundary B\nA->B: doIt',
    note: 'Must not fabricate "doIt". ANTLR = {A,B}.',
  },
  {
    name: 'message label looks like a Name',
    src: 'A->B: DoTheThing',
    note: 'Single-token label that lexes as an identifier — tempting to read as a participant.',
  },
  {
    name: 'multi-word message label',
    src: 'A->B: Get order by id',
    note: 'Each word lexes as an identifier; none are participants.',
  },
  {
    name: 'message label is a keyword',
    src: 'A->B: if',
    note: 'Label text collides with a keyword token; still just a label.',
  },
  {
    name: 'quoted method name',
    src: 'A."Get order by id"()',
    note: 'Known gap #2: quoted method name. Must not fabricate the string as a participant.',
  },
  {
    name: 'participant label and color',
    src: '@Service Foo as "Bar" #ff0000',
    note: 'Known gap #1: label+color. Must not split "Bar"/color into extra participants.',
  },
  {
    name: 'chained calls',
    src: 'A.b().c().d()',
    note: 'Method chain — only A is a participant; b/c/d are methods.',
  },
  {
    name: 'return annotation',
    src: '@Actor A\nA.run() {\n  @return B->A: ok\n}',
    note: 'Reply annotation; "ok" is a label, not a participant.',
  },
  {
    name: 'divider free text',
    src: '== Phase one ==\nA->B: go',
    note: 'Divider note words must not become participants.',
  },
  {
    name: 'ref to another diagram',
    src: 'ref(A, B)',
    note: 'ref args ARE participants per ANTLR; this checks we do not OVER-claim beyond them.',
  },
  // ── Half-typed / mid-edit states (an editor parses these constantly) ──
  { name: 'partial: annotation only', src: '@Actor', note: 'Mid-typing a declaration.' },
  { name: 'partial: dangling arrow', src: 'A->', note: 'Mid-typing a message; B not yet present.' },
  { name: 'partial: dangling dot', src: 'A.', note: 'Mid-typing a method call.' },
  {
    name: 'partial: declare then dangling arrow',
    src: '@Actor Alice\nAlice->',
    note: 'The headline trap, half-typed — must still not fabricate.',
  },
  { name: 'partial: open if', src: 'if (', note: 'Half-typed control flow.' },
  { name: 'partial: open group', src: 'group {', note: 'Half-typed group.' },
  { name: 'partial: open brace body', src: 'A.run() {', note: 'Half-typed sync body.' },
  // ── Garbage / nonsense ──
  { name: 'garbage punctuation', src: '!!!@@@###', note: 'No valid participants.' },
  { name: 'lone number', src: '12345', note: 'Numbers are not participants.' },
  { name: 'stray operators', src: '-> : . = ()', note: 'Operators with no operands.' },
  // ── Unicode / non-ASCII identifiers ──
  {
    name: 'unicode declare then message',
    src: '@Actor 用户\n用户->系统: 登录',
    note: 'Chinese identifiers; "登录" is a label, not a participant.',
  },
  // ── Punctuation-dense ──
  { name: 'semicolon-separated calls', src: 'A.m();B.n();', note: 'Two calls; participants {A,B}.' },
]

export const CORPUS: CorpusCase[] = [...POSITIVE, ...NEGATIVE]
