/*
* pythonPathUtils.ts
* Copyright (c) Microsoft Corporation.
* Licensed under the MIT license.
* Author: Eric Traut
*
* Utility routines used to resolve various paths in python.
*/

import * as fs from 'fs';

import { ConfigOptions, ExecutionEnvironment } from '../common/configOptions';
import { combinePaths, ensureTrailingDirectorySeparator, getDirectoryPath,
    getFileSystemEntries,
    isDirectory,
    normalizePath } from '../common/pathUtils';

export class PythonPathUtils {
    static getTypeShedFallbackPath() {
        // Assume that the 'typeshed-fallback' directory is up one level
        // from this javascript file.
        const moduleDirectory = (global as any).__rootDirectory;

        if (moduleDirectory) {
            return combinePaths(getDirectoryPath(
                ensureTrailingDirectorySeparator(moduleDirectory)),
                'typeshed-fallback');
        }

        return undefined;
    }

    static getTypeshedSubdirectory(typeshedPath: string, isStdLib: boolean) {
        return combinePaths(typeshedPath, isStdLib ? 'stdlib' : 'third_party');
    }

    static findPythonSearchPaths(configOptions: ConfigOptions, execEnv?: ExecutionEnvironment):
            string[] | undefined {

        let venvPath: string | undefined;
        if (execEnv && execEnv.venv) {
            if (configOptions.venvPath) {
                venvPath = combinePaths(configOptions.venvPath, execEnv.venv);
            }
        } else if (configOptions.defaultVenv) {
            if (configOptions.venvPath) {
                venvPath = combinePaths(configOptions.venvPath, configOptions.defaultVenv);
            }
        }

        if (venvPath) {
            let libPath = combinePaths(venvPath, 'lib');
            let sitePackagesPath = combinePaths(libPath, 'site-packages');
            if (fs.existsSync(sitePackagesPath)) {
                return [sitePackagesPath];
            }

            // We didn't find a site-packages directory directly in the lib
            // directory. Scan for a "python*" directory instead.
            let entries = getFileSystemEntries(libPath);
            for (let i = 0; i < entries.directories.length; i++) {
                let dirName = entries.directories[i];
                if (dirName.startsWith('python')) {
                    let dirPath = combinePaths(libPath, dirName, 'site-packages');
                    if (fs.existsSync(dirPath)) {
                        return [dirPath];
                    }
                }
            }
        }

        // Fall back on PYTHONPATH.
        return this.getPythonPathEnvironmentVariable();
    }

    static getPythonPathEnvironmentVariable(): string[] {
        let pythonPaths: string[] = [];

        const rawPythonPath = process.env.PYTHONPATH;
        if (rawPythonPath) {
            // Some OSes use semicolon separators, others use colons. We'll support
            // both here.
            let separator = rawPythonPath.indexOf(':') >= 0 ? ':' : ';';
            let pathSplit = rawPythonPath.split(separator);
            for (let path of pathSplit) {
                const normalizedPath = normalizePath(path);

                // Make sure the path exists and is a directory. We don't currenlty
                // support zip files and other formats.
                if (fs.existsSync(normalizedPath) && isDirectory(normalizedPath)) {
                    pythonPaths.push(normalizedPath);
                }
            }
        }

        return pythonPaths;
    }
}
