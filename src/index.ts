import { Command, flags } from "@oclif/command";
import cli from "cli-ux";

import * as parser from "./helpers/parser";
import * as tsReader from "./helpers/tsReader";
import * as paths from "./helpers/paths";
import * as formatter from "./helpers/formatter";

class MongooseTsgen extends Command {
  static description =
    "Generate a Typescript file containing Mongoose Schema typings.\nSpecify the directory of your Mongoose model definitions using `MODEL_PATH`. If left blank, all sub-directories will be searched for `models/*.ts` files (or `models/*.js`). Files in this folder (other than an index file) are expected to export a Mongoose model.";

  static flags = {
    help: flags.help({ char: "h" }),
    output: flags.string({
      char: "o",
      description:
        "[default: ./src/interfaces] Path of output file containing generated interfaces. If a folder path is passed, the generator will default to creating an `mongoose.gen.ts` file in the specified folder."
    }),
    "dry-run": flags.boolean({
      char: "d",
      description: "Print output rather than writing to file."
    }),
    "no-func-types": flags.boolean({
      description: "Disable using TS compiler API for method, static and query typings."
    }),
    "no-format": flags.boolean({
      description: "Disable formatting generated files with prettier and fixing with eslint."
    }),
    js: flags.boolean({
      char: "j",
      description:
        "Search for Mongoose schemas in Javascript files rather than in Typescript files."
    }),
    project: flags.string({
      char: "p",
      description: `[default: ./] Path of tsconfig.json or its root folder.`
    }),
    imports: flags.string({
      char: "i",
      description:
        "Custom import statements to add to the output file. Useful if you use third-party types in your mongoose schema definitions",
      multiple: true
    }),
    config: flags.string({
      char: "c",
      description:
        "Path of mtgen.config.json or its root folder. CLI flag options will take precendence over settings in mtgen.config.json"
    }),
    augment: flags.boolean({
      description: `Augment generated interfaces into the 'mongoose' module`
    })
  };

  // path of mongoose models folder
  static args = [{ name: "model_path" }];

  private getConfig() {
    const { flags: cliFlags, args } = this.parse(MongooseTsgen);

    type FlagConfig = Omit<typeof cliFlags, "config" | "output" | "project"> & {
      output: string;
      project: string;
    };

    const configFileFlags: Partial<FlagConfig> = paths.getConfigFromFile(cliFlags.config);

    // remove "config" since its only used to grab the config file
    delete cliFlags.config;

    // we cant set flags as `default` using the official oclif method since the defaults would overwrite flags provided in the config file.
    // instead, well just set "output" and "project" as default manually if theyre still missing after merge with configFile.
    configFileFlags.output = configFileFlags.output ?? "./src/interfaces";
    configFileFlags.project = configFileFlags.project ?? "./";

    return {
      flags: {
        ...configFileFlags,
        ...cliFlags
      } as FlagConfig,
      args
    };
  }

  async run() {
    const { flags, args } = this.getConfig();

    cli.action.start("Generating mongoose typescript definitions");

    try {
      const extension = flags.js ? "js" : "ts";
      const modelsPaths = paths.getModelsPaths(args.model_path, extension);

      let cleanupTs: any;
      if (!flags.js) {
        cleanupTs = parser.registerUserTs(flags.project);

        if (!flags["no-func-types"]) {
          const functionTypes = tsReader.getFunctionTypes(modelsPaths);
          parser.setFunctionTypes(functionTypes);
        }
      }

      const schemas = parser.loadSchemas(modelsPaths);

      const genFilePath = paths.cleanOutputPath(flags.output);
      const interfaceString = parser.generateFileString({
        schemas,
        isAugmented: flags.augment,
        imports: flags.imports
      });
      cleanupTs?.();

      cli.action.stop();
      if (flags["dry-run"]) {
        this.log("Dry run detected, generated interfaces will be printed to console:\n");
        this.log(interfaceString);
      } else {
        this.log(`Writing interfaces to ${genFilePath}`);

        parser.writeOrCreateInterfaceFiles({ genFilePath, interfaceString });
        if (!flags["no-format"]) await formatter.format([genFilePath]);
        this.log("Writing complete 🐒");
        process.exit();
      }
    } catch (error) {
      this.error(error);
    }
  }
}

export = MongooseTsgen;
