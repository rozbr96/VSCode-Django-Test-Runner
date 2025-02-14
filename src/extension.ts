import * as vscode from "vscode";

import TestsRunnerCodeLensProvider from "./tests_runner_code_lens_provider";


const METHOD_REGEX = /(\s*)def\s+(test_\w+)\s?\(/i;
const CLASS_REGEX = /(\s*)class\s+(\w+)/i;


let terminal: vscode.Terminal;

class TestRunner {
  methodName: string = "";
  className: string = "";
  filePath: string = "";
  lastRanTestPath: string = "";
  targetRange: vscode.Range | undefined;

  constructor() {
  }

  toString(): string {
    if (this.isDjangoNose()) {
      return this.filePath + ":" + this.className + "." + this.methodName;
    }
    return this.filePath + "." + this.className + "." + this.methodName;
  }

  getFullPath(): string {
    return this.toString();
  }

  getClassPath(): string {
    if (this.isDjangoNose()) {
      return this.filePath + ":" + this.className;
    }
    return this.filePath + "." + this.className;
  }

  getFilePath(): string {
    return this.filePath;
  }

  getAppPath(): string {
    return "";
  }

  updateFilePath(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const currentDocument = editor.document;
    const currentWorkspacePath = vscode.workspace.getWorkspaceFolder(
      currentDocument.uri
    );
    if (!currentWorkspacePath) {
      return;
    }

    const config = vscode.workspace.getConfiguration("", editor.document.uri)
    const testsRootDir = config.get("python.djangoTestRunner.testsRootDir", "")
    const testsRootDirRE = new RegExp(`^${testsRootDir}\\.`)

    this.filePath = currentDocument.fileName
      .replace(currentWorkspacePath.uri.fsPath, "")
      .replace(".py", "")
      .replace(/\//g, ".")
      .replace(/\\/g, ".")
      .replace(/\\\\/g, ".")
      .substring(1)
      .replace(testsRootDirRE, "");
  }

  updateClassAndMethodPath(): void {
    const editor = vscode.window.activeTextEditor;

    if (editor && editor.document.languageId === "python") {
      const currentDocument = editor.document;
      const currentWorkspacePath = vscode.workspace.getWorkspaceFolder(
        currentDocument.uri
      );

      if (currentWorkspacePath) {
        const position = editor.selection.active;
        const targetRange = this.targetRange || new vscode.Range(0, 0, position.line + 1, 0);

        const lines = currentDocument
          .getText(targetRange)
          .split(/[\r\n]+/)
          .reverse();

        this.parseLines(lines);
      }
    }
  }

  parseLines(lines: string[]): void {
    let matched;
    let methodName: string = "";
    for (let line of lines) {
      if (line.trim()) {
        if (!methodName) {
          matched = line.match(METHOD_REGEX);
          if (matched) {
            methodName = matched[2];
            this.methodName = matched[2];
            continue;
          }
        }

        matched = line.match(CLASS_REGEX);
        if (matched) {
          this.className = matched[2];
          break;
        }
      }
    }
  }

  updatePaths(): void {
    this.updateClassAndMethodPath();
    this.updateFilePath();
  }

  isDjangoNose(): boolean {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return false; }
    const config = vscode.workspace.getConfiguration("", editor.document.uri);
    return config.get("python.djangoTestRunner.djangoNose") === true;
  }

  runTests(testPath: string): void {
    this.lastRanTestPath = testPath;
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const configuration = vscode.workspace.getConfiguration(
        "",
        editor.document.uri
      );
      if (!terminal || terminal.exitStatus) {
        terminal = vscode.window.createTerminal("djangoTestRunner");
      }
      terminal.show();
      const cmds = [
        configuration.get("python.djangoTestRunner.prefixCommand"),
        configuration.get("python.pythonPath"),
        "./manage.py",
        "test",
        configuration.get("python.djangoTestRunner.flags"),
        testPath
      ];
      terminal.sendText(cmds.join(" "));
    }
  }

  runPreviousTests(): void {
    if (!this.lastRanTestPath) {
      vscode.window.showErrorMessage("No previous tests!");
      return;
    }
    this.runTests(this.lastRanTestPath);
  }

  runMethodTests(): void {
    this.updatePaths();
    this.runTests(this.getFullPath());
  }

  runClassTests(): void {
    this.updatePaths();
    this.runTests(this.getClassPath());
  }

  runFileTests(): void {
    this.updatePaths();
    this.runTests(this.getFilePath());
  }

  runAppTests(): void {
    this.updatePaths();
    this.runTests(this.getAppPath());
  }
}

let tester: TestRunner = new TestRunner();

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "python.djangoTestRunner.runPreviousTests",
      () => {
        tester.targetRange = undefined;
        tester.runPreviousTests();
      }
    ),
    vscode.commands.registerCommand(
      "python.djangoTestRunner.runMethodTests",
      (range?: vscode.Range) => {
        tester.targetRange = range;
        tester.runMethodTests();
      }
    ),
    vscode.commands.registerCommand(
      "python.djangoTestRunner.runClassTests",
      (range?: vscode.Range) => {
        tester.targetRange = range;
        tester.runClassTests();
      }
    ),
    vscode.commands.registerCommand(
      "python.djangoTestRunner.runFileTests",
      () => {
        tester.targetRange = undefined;
        tester.runFileTests();
      }
    ),
    vscode.commands.registerCommand("python.djangoTestRunner.runAppTests", () => {
      tester.targetRange = undefined;
      tester.runAppTests();
    }),
    vscode.languages.registerCodeLensProvider(
      {
        language: "python", pattern: "**/test_*.py"
      }, new TestsRunnerCodeLensProvider()
    )
  );
}

export function deactivate() { }
