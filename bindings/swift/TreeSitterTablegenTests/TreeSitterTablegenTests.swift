import XCTest
import SwiftTreeSitter
import TreeSitterTablegen

final class TreeSitterTablegenTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_tablegen())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading TableGen grammar")
    }
}
