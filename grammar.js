/**
 * @file TableGen grammar for tree-sitter
 * @author Buyun Xu <xubuyun@outlook.com>
 * @license Apache-2.0 WITH LLVM-exception
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "tablegen",

  extras: $ => [
    /\s+/,
    $.line_comment,
    $.block_comment,
  ],

  word: $ => $.identifier,

  externals: $ => [
    $.code_chunk,
    $._leading_digit_ident,
    $._error_sentinel,
  ],

  conflicts: $ => [
    [$.positional_arguments],
    [$.range_piece, $._simple_value],
  ],

  rules: {
    source_file: $ => repeat($._top_level_item),

    _top_level_item: $ => choice(
      $.include_directive,
      $.preprocessor_directive,
      $.class_definition,
      $.def_definition,
      $.defm_definition,
      $.defset_definition,
      $.deftype_definition,
      $.defvar_statement,
      $.dump_statement,
      $.assert_statement,
      $.foreach_statement,
      $.if_statement,
      $.let_statement,
      $.multiclass_definition,
    ),

    include_directive: $ => seq("include", $.string_literal),

    preprocessor_directive: $ => choice(
      seq("#define", $.macro_name),
      seq("#ifdef", $.macro_name),
      seq("#ifndef", $.macro_name),
      "#else",
      "#endif",
    ),

    macro_name: _ => /[A-Za-z_][A-Za-z0-9_]*/,

    line_comment: _ => token(seq("//", /[^\n]*/)),

    // One level of nesting via two-state regex; see spec §5.6 for upgrade path
    block_comment: _ => token(seq(
      "/*",
      repeat(choice(
        /[^*/]/,
        /\*[^/]/,
        /\/[^*]/,
        seq("/*", repeat(choice(/[^*]/, /\*[^/]/)), "*/"),
      )),
      "*/",
    )),

    // TableGen identifiers may start with digits (e.g. `3rdX`, `1OverrideOp`).
    // We match the broadest run of identifier chars; longest-match keeps purely
    // numeric tokens (`0xFF`, `123`) on integer_literal because that match is
    // strictly longer thanks to the `0x`/`0b` prefix or because integer_literal
    // has higher token-precedence on ties.
    identifier: _ => token(/[A-Za-z_0-9][A-Za-z0-9_]*/),

    // Higher token precedence than `identifier` so pure-numeric / hex / binary
    // tokens lex as integers when they tie identifier in length (`0xFF`, `42`).
    integer_literal: _ => token(prec(1, /[+-]?(0x[0-9a-fA-F]+|0b[01]+|[0-9]+)/)),

    // TableGen concatenates adjacent string literals at the parser layer
    // (TGParser ParseSimpleValue, StrVal case). Reflect that here so a multi-line
    // wrapped string parses as a single string_literal node.
    string_literal: $ => prec.left(repeat1($._string_atom)),

    // Inner content + escape_sequence are immediate tokens so `extras`
    // (whitespace, comments) cannot leak into the string body. The opening
    // `"` is a regular token to permit extras BETWEEN concatenated atoms.
    _string_atom: $ => seq(
      '"',
      repeat(choice(
        $._string_content,
        $.escape_sequence,
      )),
      token.immediate('"'),
    ),

    _string_content: _ => token.immediate(/[^"\\\n]+/),

    escape_sequence: _ => token.immediate(/\\["\\tn']/),

    boolean_literal: _ => choice("true", "false"),

    unset_value: _ => "?",

    _type: $ => choice(
      "bit",
      "int",
      "string",
      "dag",
      "code",
      seq("bits", "<", $.integer_literal, ">"),
      seq("list", "<", $._type, ">"),
      $.identifier,             // ClassID
    ),

    type: $ => $._type,         // visible alias for queries

    // Task 5: class, def, body items
    class_definition: $ => seq(
      "class",
      $.identifier,
      optional($.template_parameters),       // declared in Task 6
      optional($.parent_class_list),
      $.body,
    ),

    def_definition: $ => seq(
      "def",
      optional($.object_name),
      optional($.parent_class_list),
      $.body,
    ),

    defm_definition: $ => seq(
      "defm",
      optional($.object_name),
      optional($.parent_class_list),
      ";",
    ),

    object_name: $ => $._value,

    defset_definition: $ => seq(
      "defset",
      $.type,
      $.identifier,
      "=",
      "{",
      repeat($._top_level_item),
      "}",
    ),

    deftype_definition: $ => seq(
      "deftype",
      $.identifier,
      "=",
      $.type,
      ";",
    ),

    dump_statement: $ => seq("dump", $._value, ";"),

    foreach_statement: $ => seq(
      "foreach",
      $.identifier,
      "=",
      choice($.range_list, $.range_piece, $._value),
      "in",
      choice(
        seq("{", repeat($._foreach_body_item), "}"),
        $._foreach_body_item,
      ),
    ),

    _foreach_body_item: $ => choice(
      $._top_level_item,
      $.field_declaration,
      $.let_assignment,
    ),

    if_statement: $ => prec.right(seq(
      "if",
      $._value,
      "then",
      $._if_body,
      optional(seq("else", $._if_body)),
    )),

    _if_body: $ => choice(
      seq("{", repeat($._foreach_body_item), "}"),
      $._foreach_body_item,
    ),

    let_statement: $ => seq(
      "let",
      $.let_item,
      repeat(seq(",", $.let_item)),
      "in",
      choice(
        seq("{", repeat($._foreach_body_item), "}"),
        $._foreach_body_item,
      ),
    ),

    let_item: $ => seq(
      optional($.let_mode),
      $.identifier,
      optional($.range_list),
      "=",
      $._value,
    ),

    multiclass_definition: $ => seq(
      "multiclass",
      $.identifier,
      optional($.template_parameters),
      optional($.parent_class_list),
      "{",
      repeat($._multiclass_body_item),
      "}",
    ),

    _multiclass_body_item: $ => choice(
      $.def_definition,
      $.defm_definition,
      $.defvar_statement,
      $.foreach_statement,
      $.if_statement,
      $.let_statement,
      $.assert_statement,
    ),

    parent_class_list: $ => seq(
      ":",
      $.parent_class,
      repeat(seq(",", $.parent_class)),
    ),

    parent_class: $ => seq(
      $.identifier,
      optional(seq("<", optional($.argument_list), ">")),  // argument_list in Task 9
    ),

    // Higher precedence than _base_value to resolve conflict when seeing '{'
    body: $ => choice(
      ";",
      seq("{", repeat($._body_item), "}"),
    ),

    _body_item: $ => choice(
      $.field_declaration,
      $.let_assignment,
      $.defvar_statement,
      $.assert_statement,
      $.foreach_statement,
      $.if_statement,
      $.dump_statement,
    ),

    field_declaration: $ => seq(
      optional("field"),
      $.type,
      $.identifier,
      optional(seq("=", $._value)),
      ";",
    ),

    let_assignment: $ => seq(
      "let",
      optional($.let_mode),
      $.identifier,
      optional($.range_list),                // range_list in Task 7
      "=",
      $._value,
      ";",
    ),

    let_mode: _ => choice("append", "prepend"),

    defvar_statement: $ => seq(
      "defvar",
      $.identifier,
      "=",
      $._value,
      ";",
    ),

    assert_statement: $ => seq(
      "assert",
      $._value,
      ",",
      $._value,
      ";",
    ),

    // Task 7: Full value layer with suffix, paste, list/bits/dag literals
    // _value is a simple value with optional suffixes, or a paste expression
    _value: $ => prec.left(choice(
      seq($._simple_value, repeat($._value_suffix)),
      $.paste_expression,
    )),

    paste_expression: $ => prec.left(seq(
      $._value,
      "#",
      optional($._value),
    )),

    _simple_value: $ => choice(
      // TableGen accepts record names with leading digits (e.g. `1OverrideOp`,
      // `3rdX`). Tree-sitter's built-in lexer cannot outrank `integer_literal`
      // (whose precedence wins ties) without losing on hex/bin tokens. The
      // external scanner emits the whole name as a single token, surfaced
      // here as `identifier` so queries continue to match.
      alias($._leading_digit_ident, $.identifier),
      $.integer_literal,
      $.string_literal,
      $.boolean_literal,
      $.unset_value,
      $.bits_value,
      $.list_value,
      $.dag_value,
      $.anonymous_record,
      $.bang_operator_call,
      $.cond_operator_call,
      prec.dynamic(1, $.code_literal),
      $.identifier,
    ),

    code_literal: $ => seq(
      token(seq("[", "{")),
      repeat(choice(
        $.code_chunk,
        $.variable_substitution,
      )),
      token(seq("}", "]")),
    ),

    // Inside code literals, `$N` (positional) and `$name` are both substitutions
    // (NativeCodeCall and op assembly format use `$0`, `$1`, ...).  Emit as a
    // single token so highlight queries can colour the entire `$name` uniformly,
    // matching the VS Code TextMate convention `(\$\w+)\b`.
    variable_substitution: _ => token.immediate(seq("$", /[A-Za-z0-9_]+/)),

    anonymous_record: $ => seq(
      $.identifier,
      "<",
      optional($.argument_list),
      ">",
    ),

    bits_value: $ => seq(
      "{",
      optional(seq($._value, repeat(seq(",", $._value)), optional(","))),
      "}",
    ),

    list_value: $ => seq(
      "[",
      optional(seq($._value, repeat(seq(",", $._value)), optional(","))),
      "]",
      optional(seq("<", $.type, ">")),
    ),

    // TableGen DAG: '(' operator (arg (',' arg)* ','?)? ')'
    // The operator and the first arg are separated by whitespace, not a comma.
    // Trailing comma is permitted (TGParser tolerates it in arg lists).
    dag_value: $ => seq(
      "(",
      $.dag_arg,
      optional(seq(
        $.dag_arg,
        repeat(seq(",", $.dag_arg)),
        optional(","),
      )),
      ")",
    ),

    dag_arg: $ => choice(
      seq($._value, optional(seq(":", $.variable_name))),
      $.variable_name,
    ),

    variable_name: _ => token(seq("$", /[A-Za-z_][A-Za-z0-9_]*/)),

    _value_suffix: $ => choice(
      $.value_suffix_braces,
      $.value_suffix_brackets,
      $.value_suffix_dot,
    ),

    value_suffix_braces: $ => $.range_list,

    value_suffix_brackets: $ => seq(
      "[",
      $.slice_element,
      repeat(seq(",", $.slice_element)),
      optional(","),
      "]",
    ),

    value_suffix_dot: $ => seq(".", $.identifier),

    range_list: $ => seq(
      "{",
      $.range_piece,
      repeat(seq(",", $.range_piece)),
      "}",
    ),

    range_piece: $ => choice(
      $.integer_literal,
      seq($.integer_literal, "...", $.integer_literal),
      seq($.integer_literal, "-", $.integer_literal),
      seq($.integer_literal, $.integer_literal),
    ),

    slice_element: $ => choice(
      $._value,
      seq($._value, "...", $._value),
      seq($._value, "-", $._value),
      seq($._value, $.integer_literal),
    ),

    template_parameters: $ => seq(
      "<",
      $.template_parameter,
      repeat(seq(",", $.template_parameter)),
      ">",
    ),

    template_parameter: $ => seq(
      $.type,
      $.identifier,
      optional(seq("=", $._value)),
    ),

    // Task 9: Full argument list with positional + named arguments
    argument_list: $ => choice(
      seq($.positional_arguments, optional(seq(",", $.named_arguments))),
      $.named_arguments,
    ),

    positional_arguments: $ => seq(
      $._value,
      repeat(seq(",", $._value)),
    ),

    named_arguments: $ => seq(
      $.named_argument,
      repeat(seq(",", $.named_argument)),
    ),

    named_argument: $ => seq(
      $.identifier,
      "=",
      $._value,
    ),

    bang_operator: _ => choice(
      "!add", "!and", "!cast", "!con", "!dag", "!div", "!empty", "!eq", "!exists", "!filter",
      "!find", "!foldl", "!foreach", "!ge", "!getdagarg", "!getdagname", "!getdagop", "!getdagopname",
      "!gt", "!head", "!if", "!initialized", "!instances", "!interleave", "!isa", "!le",
      "!listconcat", "!listflatten", "!listremove", "!listsplat", "!logtwo", "!lt", "!match",
      "!mul", "!ne", "!not", "!or", "!range", "!repr", "!setdagarg", "!setdagname",
      "!setdagop", "!setdagopname", "!shl", "!size", "!sort", "!sra", "!srl", "!strconcat", "!sub",
      "!subst", "!substr", "!tail", "!tolower", "!toupper", "!xor",
    ),

    bang_operator_call: $ => seq(
      $.bang_operator,
      optional(seq("<", $.type, ">")),
      "(",
      $._value,
      repeat(seq(",", $._value)),
      optional(","),
      ")",
    ),

    cond_operator_call: $ => seq(
      "!cond",
      "(",
      $.cond_clause,
      repeat(seq(",", $.cond_clause)),
      optional(","),
      ")",
    ),

    cond_clause: $ => seq($._value, ":", $._value),

  },
});
