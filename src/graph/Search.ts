import Node from "./Node";

// A subset of Obsidian's search syntax, enough for graph filters and color groups:
//   tag:#foo  tag:foo     note has the tag (or a nested tag under it)
//   path:foo  file:foo    path / file name contains foo
//   foo  "foo bar"        path or file name contains the text
//   -term  -(…)           negates a term or a group
//   a OR b                either side matches
//   (a OR b) c            parentheses group terms
// Terms are ANDed. Plain words only match the path and file name; Obsidian
// also searches note contents, which isn't available here. Operators that
// only work on contents (content:, line:, …), [properties] and /regex/ can't
// be evaluated: see unsupportedSyntax.

type Field = "tag" | "path" | "file" | "any";
type Expr =
	| { type: "term"; field: Field; value: string }
	| { type: "not"; expr: Expr }
	| { type: "and" | "or"; exprs: Expr[] };

const SUPPORTED_FIELDS = new Set(["tag", "path", "file"]);

// "(", ")", or a term: optional -, optional field:, then a "quoted" or bare word
const tokenize = (query: string): string[] =>
	query.match(/[()]|-?(?:[\w-]+:)?(?:"[^"]*"|[^\s()"]+)|-(?=\()|"[^"]*"/g) ?? [];

const parseTerm = (token: string): Expr => {
	let negate = false;
	if (token.startsWith("-")) {
		negate = true;
		token = token.slice(1);
	}
	let field: Field = "any";
	const m = token.match(/^(tag|path|file):(.*)$/i);
	if (m) {
		field = m[1].toLowerCase() as Field;
		token = m[2];
	}
	let value = token.replace(/^"(.*)"$/, "$1").toLowerCase();
	if (field === "tag") value = value.replace(/^#/, "");
	const term: Expr = { type: "term", field, value };
	return negate ? { type: "not", expr: term } : term;
};

// or := and ("OR" and)* ; and := unary+ ; unary := "-"? "(" or ")" | term
const parse = (tokens: string[]): Expr | null => {
	let i = 0;
	const parseOr = (): Expr | null => {
		const exprs: Expr[] = [];
		for (;;) {
			const and = parseAnd();
			if (and) exprs.push(and);
			if (tokens[i] === "OR") i++;
			else break;
		}
		if (exprs.length === 0) return null;
		return exprs.length === 1 ? exprs[0] : { type: "or", exprs };
	};
	const parseAnd = (): Expr | null => {
		const exprs: Expr[] = [];
		while (i < tokens.length && tokens[i] !== "OR" && tokens[i] !== ")") {
			const token = tokens[i++];
			if (token === "(" || token === "-") {
				if (token === "-") i++; // the "(" after it
				const inner = parseOr();
				if (tokens[i] === ")") i++;
				if (inner) exprs.push(token === "-" ? { type: "not", expr: inner } : inner);
			} else exprs.push(parseTerm(token));
		}
		if (exprs.length === 0) return null;
		return exprs.length === 1 ? exprs[0] : { type: "and", exprs };
	};
	const expr = parseOr();
	// stray ")" with no "(": skip it and keep going
	while (i < tokens.length) {
		i++;
		const rest = parseOr();
		if (rest) return expr ? { type: "and", exprs: [expr, rest] } : rest;
	}
	return expr;
};

const evaluate = (expr: Expr, node: Node): boolean => {
	switch (expr.type) {
		case "not":
			return !evaluate(expr.expr, node);
		case "and":
			return expr.exprs.every((e) => evaluate(e, node));
		case "or":
			return expr.exprs.some((e) => evaluate(e, node));
	}
	switch (expr.field) {
		case "tag":
			return node.tags.some((tag) => {
				const t = tag.toLowerCase();
				return t === expr.value || t.startsWith(expr.value + "/");
			});
		case "path":
			return node.path.toLowerCase().includes(expr.value);
		case "file":
			return node.name.toLowerCase().includes(expr.value);
		default:
			return (
				node.path.toLowerCase().includes(expr.value) ||
				node.name.toLowerCase().includes(expr.value)
			);
	}
};

export type Matcher = (node: Node) => boolean;

// Compiles a query into a matcher; an empty query matches nothing
export const compileQuery = (query: string): Matcher => {
	const expr = parse(tokenize(query.trim()));
	if (!expr) return () => false;
	return (node) => evaluate(expr, node);
};

// Whether the query has any terms at all
export const isEmptyQuery = (query: string) =>
	tokenize(query.trim()).every((t) => t === "(" || t === ")" || t === "-" || t === "OR");

// The part of a query this subset can't evaluate (so results would differ
// from Obsidian's), or null if it is all supported
export const unsupportedSyntax = (query: string): string | null => {
	const q = query.trim();
	const regex = q.match(/(?:^|\s|[(:-])\/[^/]+\//);
	if (regex) return regex[0].trim();
	const property = q.match(/\[[^\]]*\]?/);
	if (property) return property[0];
	for (const token of tokenize(q)) {
		const m = token.match(/^-?([\w-]+):/);
		if (m && !SUPPORTED_FIELDS.has(m[1].toLowerCase())) return `${m[1]}:`;
	}
	return null;
};
