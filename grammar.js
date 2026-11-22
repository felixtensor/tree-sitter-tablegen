/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// ---------------------------------------------------------------------------
// Grammar DSL helpers (pure expansion; keep generated grammar.json flat)
// ---------------------------------------------------------------------------

// prettier-ignore
/** @param {RuleOrLiteral} rule */
const commaSep1 = rule => seq(rule, repeat(seq(',', rule)));

// prettier-ignore
/** @param {RuleOrLiteral} rule */
const commaSepTrailing = rule => optional(seq(rule, repeat(seq(',', rule)), optional(',')));

// prettier-ignore
export default grammar({
  name: 'tablegen',
  extras: $ => [/\s+/, $.line_comment, $.block_comment],
  // Match keyword literals against `identifier` so reserved words are never silently lexed as identifiers.
  word: $ => $.identifier,
  externals: $ => [$.code_chunk, $._leading_digit_ident, $._error_sentinel],
  conflicts: $ => [
    [$.positional_arguments], // `,` after positional arg: next positional arg vs named args
    [$.range_piece, $._simple_value], // `foreach` iterator: `integer_literal` starts range piece or value
  ],

  rules: {
    // =========================================================================
    // Top level & directives
    // =========================================================================
    source_file: $ => repeat($._top_level_item),
    _top_level_item: $ => choice(
      $.include_directive, $.preprocessor_directive,
      $.class_definition, $.def_definition, $.defm_definition,
      $.defset_definition, $.deftype_definition,
      $.defvar_statement, $.dump_statement, $.assert_statement,
      $.foreach_statement, $.if_statement, $.let_statement,
      $.multiclass_definition,
    ),

    include_directive: $ => seq('include', $.string_literal),
    preprocessor_directive: $ => choice(
      seq('#define', $.macro_name),
      seq('#ifdef', $.macro_name),
      seq('#ifndef', $.macro_name),
      '#else',
      '#endif',
    ),
    macro_name: _ => /[A-Za-z_][A-Za-z0-9_]*/,

    // =========================================================================
    // Comments & literals
    // =========================================================================
    line_comment: _ => token(seq('//', /[^\n]*/)),
    // Supports one level of nesting via a two-state regex.
    block_comment: _ => token(seq(
      '/*',
      repeat(choice(
        /[^*/]/, /\*[^/]/, /\/[^*]/,
        seq('/*', repeat(choice(/[^*]/, /\*[^/]/)), '*/'),
      )),
      '*/',
    )),

    // Identifiers may start with digits (e.g. `3rdX`, `1OverrideOp`); `integer_literal`
    // wins purely numeric / hex / binary ties via higher token precedence.
    identifier: _ => token(/[A-Za-z_0-9][A-Za-z0-9_]*/),
    integer_literal: _ => token(prec(1, /[+-]?(0x[0-9a-fA-F]+|0b[01]+|[0-9]+)/)),

    // Adjacent string literals concatenate into one node (TGParser::ParseSimpleValue).
    // Inner tokens use `token.immediate` so extras cannot leak inside; opening `"` is
    // a regular token so extras are permitted between concatenated atoms.
    string_literal: $ => prec.left(repeat1($._string_atom)),
    _string_atom: $ => seq('"', repeat(choice($._string_content, $.escape_sequence)), token.immediate('"')),
    _string_content: _ => token.immediate(/[^"\\\n]+/),
    escape_sequence: _ => token.immediate(/\\["\\tn']/),

    boolean_literal: _ => choice('true', 'false'),
    unset_value: _ => '?',

    // =========================================================================
    // Types
    // =========================================================================
    _type: $ => choice(
      'bit', 'int', 'string', 'dag', 'code',
      seq('bits', '<', $.integer_literal, '>'),
      seq('list', '<', $._type, '>'),
      $.identifier, // ClassID
    ),
    // Visible alias for highlight and AST queries.
    type: $ => $._type,

    // =========================================================================
    // Declarations & control flow
    // =========================================================================
    class_definition: $ => seq(
      'class', $.identifier, optional($.template_parameters), optional($.parent_class_list), $.body,
    ),
    def_definition: $ => seq('def', optional($.object_name), optional($.parent_class_list), $.body),
    defm_definition: $ => seq('defm', optional($.object_name), optional($.parent_class_list), ';'),
    object_name: $ => $._value,
    defset_definition: $ => seq('defset', $.type, $.identifier, '=', '{', repeat($._top_level_item), '}'),
    deftype_definition: $ => seq('deftype', $.identifier, '=', $.type, ';'),
    dump_statement: $ => seq('dump', $._value, ';'),

    foreach_statement: $ => seq(
      'foreach', $.identifier, '=', choice($.range_list, $.range_piece, $._value), 'in',
      choice(seq('{', repeat($._foreach_body_item), '}'), $._foreach_body_item),
    ),
    _foreach_body_item: $ => choice($._top_level_item, $.field_declaration, $.let_assignment),

    if_statement: $ => prec.right(seq(
      'if', $._value, 'then', $._if_body, optional(seq('else', $._if_body)),
    )),
    _if_body: $ => choice(seq('{', repeat($._foreach_body_item), '}'), $._foreach_body_item),

    let_statement: $ => seq(
      'let', $.let_item, repeat(seq(',', $.let_item)), 'in',
      choice(seq('{', repeat($._foreach_body_item), '}'), $._foreach_body_item),
    ),
    let_item: $ => seq(optional($.let_mode), $.identifier, optional($.range_list), '=', $._value),

    multiclass_definition: $ => seq(
      'multiclass', $.identifier, optional($.template_parameters), optional($.parent_class_list),
      '{', repeat($._multiclass_body_item), '}',
    ),
    _multiclass_body_item: $ => choice(
      $.def_definition, $.defm_definition, $.defvar_statement,
      $.foreach_statement, $.if_statement, $.let_statement, $.assert_statement,
    ),

    // =========================================================================
    // Inheritance & record bodies
    // =========================================================================
    parent_class_list: $ => seq(':', $.parent_class, repeat(seq(',', $.parent_class))),
    parent_class: $ => seq($.identifier, optional(seq('<', optional($.argument_list), '>'))),

    body: $ => choice(';', seq('{', repeat($._body_item), '}')),
    _body_item: $ => choice(
      $.field_declaration, $.let_assignment, $.defvar_statement,
      $.assert_statement, $.foreach_statement, $.if_statement, $.dump_statement,
    ),

    field_declaration: $ => seq(optional('field'), $.type, $.identifier, optional(seq('=', $._value)), ';'),
    let_assignment: $ => seq(
      'let', optional($.let_mode), $.identifier, optional($.range_list), '=', $._value, ';',
    ),
    let_mode: _ => choice('append', 'prepend'),
    defvar_statement: $ => seq('defvar', $.identifier, '=', $._value, ';'),
    assert_statement: $ => seq('assert', $._value, ',', $._value, ';'),

    // =========================================================================
    // Values & expressions
    // =========================================================================
    _value: $ => prec.left(choice(
      seq($._simple_value, repeat($._value_suffix)),
      $.paste_expression,
    )),
    paste_expression: $ => prec.left(seq($._value, '#', optional($._value))),

    _simple_value: $ => choice(
      // External scanner emits leading-digit record names (e.g. `1OverrideOp`, `3rdX`)
      // so they outrank `integer_literal` without stealing `0x`/`0b`; surface as `identifier`.
      alias($._leading_digit_ident, $.identifier),
      $.integer_literal, $.string_literal, $.boolean_literal, $.unset_value,
      $.bits_value, $.list_value, $.dag_value, $.anonymous_record,
      $.bang_operator_call, $.cond_operator_call,
      prec.dynamic(1, $.code_literal),
      $.identifier,
    ),

    code_literal: $ => seq(
      token(seq('[', '{')),
      repeat(choice($.code_chunk, $.variable_substitution)),
      token(seq('}', ']')),
    ),
    // Emit `$N` (positional) and `$name` as one token inside code literals for uniform highlighting.
    variable_substitution: _ => token.immediate(seq('$', /[A-Za-z0-9_]+/)),

    anonymous_record: $ => seq($.identifier, '<', optional($.argument_list), '>'),
    bits_value: $ => seq('{', commaSepTrailing($._value), '}'),
    list_value: $ => seq('[', commaSepTrailing($._value), ']', optional(seq('<', $.type, '>'))),

    // DAG `(op arg1, arg2, ...)`: operator and first arg are whitespace-separated; trailing comma allowed.
    dag_value: $ => seq('(', $.dag_arg, commaSepTrailing($.dag_arg), ')'),
    dag_arg: $ => choice(seq($._value, optional(seq(':', $.variable_name))), $.variable_name),
    variable_name: _ => token(seq('$', /[A-Za-z_][A-Za-z0-9_]*/)),

    // =========================================================================
    // Suffixes, ranges & slices
    // =========================================================================
    _value_suffix: $ => choice($.value_suffix_braces, $.value_suffix_brackets, $.value_suffix_dot),
    value_suffix_braces: $ => $.range_list,
    value_suffix_brackets: $ => seq(
      '[', $.slice_element, repeat(seq(',', $.slice_element)), optional(','), ']',
    ),
    value_suffix_dot: $ => seq('.', $.identifier),

    range_list: $ => seq('{', $.range_piece, repeat(seq(',', $.range_piece)), '}'),
    range_piece: $ => choice(
      $.integer_literal,
      seq($.integer_literal, '...', $.integer_literal),
      seq($.integer_literal, '-', $.integer_literal),
      seq($.integer_literal, $.integer_literal),
    ),
    slice_element: $ => choice(
      $._value,
      seq($._value, '...', $._value),
      seq($._value, '-', $._value),
      seq($._value, $.integer_literal),
    ),

    // =========================================================================
    // Templates & arguments
    // =========================================================================
    template_parameters: $ => seq('<', $.template_parameter, repeat(seq(',', $.template_parameter)), '>'),
    template_parameter: $ => seq($.type, $.identifier, optional(seq('=', $._value))),

    argument_list: $ => choice(
      seq($.positional_arguments, optional(seq(',', $.named_arguments))),
      $.named_arguments,
    ),
    positional_arguments: $ => commaSep1($._value),
    named_arguments: $ => commaSep1($.named_argument),
    named_argument: $ => seq($.identifier, '=', $._value),

    // =========================================================================
    // Bang operators
    // =========================================================================
    bang_operator: _ => choice(
      '!add', '!and', '!cast', '!con', '!dag', '!div', '!empty', '!eq', '!exists', '!filter',
      '!find', '!foldl', '!foreach', '!ge', '!getdagarg', '!getdagname', '!getdagop', '!getdagopname',
      '!gt', '!head', '!if', '!initialized', '!instances', '!interleave', '!isa', '!le',
      '!listconcat', '!listflatten', '!listremove', '!listsplat', '!logtwo', '!lt', '!match',
      '!mul', '!ne', '!not', '!or', '!range', '!repr', '!setdagarg', '!setdagname',
      '!setdagop', '!setdagopname', '!shl', '!size', '!sort', '!sra', '!srl', '!strconcat', '!sub',
      '!subst', '!substr', '!tail', '!tolower', '!toupper', '!xor',
    ),
    bang_operator_call: $ => seq(
      $.bang_operator, optional(seq('<', $.type, '>')),
      '(', $._value, repeat(seq(',', $._value)), optional(','), ')',
    ),
    cond_operator_call: $ => seq(
      '!cond', '(', $.cond_clause, repeat(seq(',', $.cond_clause)), optional(','), ')',
    ),
    cond_clause: $ => seq($._value, ':', $._value),
  },
});
