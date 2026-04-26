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

  conflicts: $ => [
    [$.positional_arguments],
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
      // foreach/if/let/multiclass next task
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

    identifier: _ => token(prec(-1, /[0-9]*[A-Za-z_][A-Za-z0-9_]*/)),

    integer_literal: _ => token(/[+-]?(0x[0-9a-fA-F]+|0b[01]+|[0-9]+)/),

    string_literal: _ => token(seq(
      '"',
      repeat(choice(
        /[^"\\\n]/,
        /\\["\\tn']/,
      )),
      '"',
    )),

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
      optional($._value),                    // _value declared below; temporary stub
      optional($.parent_class_list),
      $.body,
    ),

    defm_definition: $ => seq(
      "defm",
      optional($._value),
      optional($.parent_class_list),
      ";",
    ),

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
      // foreach/if/dump added in later tasks
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
      $.identifier,
    ),

    anonymous_record: $ => seq(
      $.identifier,
      "<",
      optional($.argument_list),
      ">",
    ),

    bits_value: $ => seq(
      "{",
      optional(seq($._value, repeat(seq(",", $._value)))),
      "}",
    ),

    list_value: $ => seq(
      "[",
      optional(seq($._value, repeat(seq(",", $._value)))),
      "]",
      optional(seq("<", $.type, ">")),
    ),

    dag_value: $ => seq(
      "(",
      $._dag_simple_value,
      repeat(seq(",", $.dag_arg)),
      ")",
    ),

    // A simple value for dag contexts - avoids ambiguity with consecutive identifiers
    // This is a restricted form of _value that doesn't include paste expressions
    _dag_simple_value: $ => seq($._simple_value, repeat($._value_suffix)),

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
      "!setdagop", "!setdagopname", "!shl", "!size", "!sra", "!srl", "!strconcat", "!sub",
      "!subst", "!substr", "!tail", "!tolower", "!toupper", "!xor",
    ),

    bang_operator_call: $ => seq(
      $.bang_operator,
      optional(seq("<", $.type, ">")),
      "(",
      $._value,
      repeat(seq(",", $._value)),
      ")",
    ),

    cond_operator_call: $ => seq(
      "!cond",
      "(",
      $.cond_clause,
      repeat(seq(",", $.cond_clause)),
      ")",
    ),

    cond_clause: $ => seq($._value, ":", $._value),

  },
});
