;; Scopes
(class_definition)      @local.scope
(multiclass_definition) @local.scope
(def_definition)        @local.scope
(foreach_statement)     @local.scope
(let_statement)         @local.scope

;; Definitions
(class_definition (identifier) @local.definition)
(def_definition (identifier) @local.definition)
(multiclass_definition (identifier) @local.definition)
(template_parameter (identifier) @local.definition)
(defvar_statement (identifier) @local.definition)
(field_declaration (identifier) @local.definition)

;; References
(identifier) @local.reference
