;; Comments
(line_comment) @comment
(block_comment) @comment

;; Keywords (statements)
"class"      @keyword
"def"        @keyword
"defm"       @keyword
"defset"     @keyword
"deftype"    @keyword
"defvar"     @keyword
"multiclass" @keyword
"let"        @keyword
"in"         @keyword
"foreach"    @keyword
"if"         @keyword
"then"       @keyword
"else"       @keyword
"include"    @keyword.import
"assert"     @keyword
"dump"       @keyword
"field"      @keyword

(let_mode) @keyword.modifier

;; Preprocessor
"#define"  @keyword.directive
"#ifdef"   @keyword.directive
"#ifndef"  @keyword.directive
"#else"    @keyword.directive
"#endif"   @keyword.directive
(macro_name) @constant.macro

;; Types
"bit"    @type.builtin
"bits"   @type.builtin
"int"    @type.builtin
"string" @type.builtin
"dag"    @type.builtin
"code"   @type.builtin
"list"   @type.builtin

;; Literals
(integer_literal)  @number
(string_literal)   @string
(boolean_literal)  @boolean
(unset_value)      @constant.builtin

;; Bang operators (single capture for the whole !xxx token)
(bang_operator) @function.builtin
"!cond"         @function.builtin

;; Variable substitution inside code blocks
(variable_substitution) @variable.parameter
(variable_name)         @variable.parameter

;; Code blocks
(code_chunk) @embedded

;; Class / def / multiclass names — definition position
(class_definition (identifier) @type.definition)
(def_definition (identifier) @constant)
(multiclass_definition (identifier) @function.macro)

;; Parent class references
(parent_class (identifier) @type)

;; Field declarations
(field_declaration (identifier) @property)

;; Named arguments
(named_argument (identifier) @field)

;; Punctuation
[ "{" "}" "[" "]" "(" ")" "<" ">" ] @punctuation.bracket
[ "," ";" ":" "." ] @punctuation.delimiter
[ "=" "#" ] @operator

;; ─── MLIR dialect-flavor predicates ─────────────────────────────────────────
;; (Per spec §2.1: dialect identification is queries-side, not grammar-side.)

;; Common MLIR ODS base classes
(parent_class (identifier) @type.builtin
  (#match? @type.builtin "^(Op|Pattern|Pat|Intrinsic|Attr|AttrDef|TypeDef|Dialect|Interface|OpInterface|AttrInterface|TypeInterface|Constraint|Pred|Property)$"))

;; ODS def names that follow the "Op" / "Type" / "Attr" suffix convention
(def_definition (identifier) @type
  (#match? @type "Op$|Type$|Attr$"))

;; Common ODS field names
(field_declaration (identifier) @property.special
  (#match? @property.special "^(arguments|results|regions|successors|summary|description|hasVerifier|hasCanonicalizer|hasCanonicalizeMethod|assemblyFormat|extraClassDeclaration|builders|hasFolder)$"))
