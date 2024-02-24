
import {
    CodeLens,
    CodeLensProvider,
    Command,
    Position,
    ProviderResult,
    Range,
    TextDocument,
} from "vscode";


const COMMANDS = {
    class: "python.djangoTestRunner.runClassTests",
    def: "python.djangoTestRunner.runMethodTests",
};

const TITLES = {
    class: "Test this entire class",
    def: "Test this method",
};

interface REMatchGroup {
    token: "class" | "def",
    [key: string]: string,
};


class TestsRunnerCodeLensProvider implements CodeLensProvider {
    DEFINITION_MATCH = /(?<token>def|class)\s+(?:(?<=def\s+)test_|(?<=class\s+))\w+[:(]/;

    provideCodeLenses(document: TextDocument): ProviderResult<CodeLens[]> {
        const lens: CodeLens[] = [];
        const lines = document.getText().split("\n");

        let match: RegExpMatchArray | null
        for ( let lineIndex = 0; lineIndex < lines.length; lineIndex++ ) {
            if (!(match = lines[lineIndex].match(this.DEFINITION_MATCH))) continue;

            const { token } = match.groups as REMatchGroup;

            let range = new Range(
                new Position(lineIndex, 0),
                new Position(lineIndex, lines[lineIndex].length)
            );

            let command = {
                title: TITLES[token],
                command: COMMANDS[token],
                arguments: [new Range(0, 0, lineIndex + 1, 0)]
            } as Command;

            lens.push(new CodeLens(range, command));
        }

        return lens;
    }
}

export default TestsRunnerCodeLensProvider;
