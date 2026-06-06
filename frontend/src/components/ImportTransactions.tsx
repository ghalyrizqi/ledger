
import { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Upload, Download, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { importTransactions, downloadTemplate, ImportResult } from '@/lib/import';
import { Category } from '@/types';

interface ImportTransactionsProps {
    userId: number;
    categories: Category[];
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ParsedRow {
    date: string;
    description: string;
    amount: string;
    type: string;
    category: string;
    isValid: boolean;
    error?: string;
}

export default function ImportTransactions({
    userId,
    categories,
    isOpen,
    onClose,
    onSuccess,
}: ImportTransactionsProps) {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setImportResult(null);
            parseFile(selectedFile);
        }
    };

    const parseFile = (file: File) => {
        Papa.parse(file, {
            complete: (results) => {
                const rows = results.data as string[][];

                // Skip header row and parse data
                const parsed = rows.slice(1).filter((row): row is string[] => {
                    return row.length >= 5 && !!row[0];
                }).map((row) => {
                    const [date, description, amount, type, category] = row;
                    const validation = validateRow(date, description, amount, type, category);

                    return {
                        date,
                        description,
                        amount,
                        type,
                        category,
                        isValid: validation.isValid,
                        error: validation.error,
                    };
                });

                setParsedData(parsed);
            },
            error: (error) => {
                alert(`Error parsing file: ${error.message}`);
            },
        });
    };

    const validateRow = (date: string, description: string, amount: string, type: string, category: string) => {
        // Validate date
        const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{4}$/;
        if (!dateRegex.test(date)) {
            return { isValid: false, error: 'Invalid date format' };
        }

        // Validate amount
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return { isValid: false, error: 'Invalid amount' };
        }

        // Validate type
        if (type.toLowerCase() !== 'income' && type.toLowerCase() !== 'expense') {
            return { isValid: false, error: 'Type must be income or expense' };
        }

        // Validate category exists
        const categoryExists = categories.some(
            (c) => c.name.toLowerCase() === category.toLowerCase()
        );
        if (!categoryExists) {
            return { isValid: false, error: `Category "${category}" not found` };
        }

        return { isValid: true };
    };

    const handleImport = async () => {
        if (!file) return;

        setIsImporting(true);
        try {
            // Read file content
            const text = await file.text();

            // Call import API
            const result = await importTransactions(userId, text);
            setImportResult(result);

            if (result.success) {
                setTimeout(() => {
                    onSuccess();
                    handleClose();
                }, 2000);
            }
        } catch (error: any) {
            alert(`Import failed: ${error.message}`);
        } finally {
            setIsImporting(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setParsedData([]);
        setImportResult(null);
        onClose();
    };

    const validCount = parsedData.filter((r) => r.isValid).length;
    const invalidCount = parsedData.filter((r) => !r.isValid).length;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Import Transactions</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to import multiple transactions at once.
                    </DialogDescription>
                </DialogHeader>

                {!importResult ? (
                    <>
                        {/* Template Download */}
                        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div>
                                <p className="font-medium text-sm">Need a template?</p>
                                <p className="text-xs text-muted-foreground">
                                    Download a sample CSV file to get started
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={downloadTemplate}>
                                <Download className="h-4 w-4 mr-2" />
                                Download Template
                            </Button>
                        </div>

                        {/* File Upload */}
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <p className="mb-2 font-medium">Upload CSV File</p>
                            <p className="text-sm text-muted-foreground mb-4">
                                Expected columns: Date, Description, Amount, Type, Category
                            </p>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label htmlFor="csv-upload">
                                <Button asChild variant="outline">
                                    <span>Choose File</span>
                                </Button>
                            </label>
                            {file && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Selected: {file.name}
                                </p>
                            )}
                        </div>

                        {/* Preview Table */}
                        {parsedData.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold">Preview ({parsedData.length} rows)</h3>
                                    <div className="flex gap-4 text-sm">
                                        <span className="flex items-center gap-1 text-green-600">
                                            <CheckCircle2 className="h-4 w-4" />
                                            {validCount} valid
                                        </span>
                                        {invalidCount > 0 && (
                                            <span className="flex items-center gap-1 text-red-600">
                                                <XCircle className="h-4 w-4" />
                                                {invalidCount} invalid
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="max-h-64 overflow-auto border rounded-lg">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                                            <tr>
                                                <th className="px-2 py-2 text-left">Status</th>
                                                <th className="px-2 py-2 text-left">Date</th>
                                                <th className="px-2 py-2 text-left">Description</th>
                                                <th className="px-2 py-2 text-right">Amount</th>
                                                <th className="px-2 py-2 text-left">Type</th>
                                                <th className="px-2 py-2 text-left">Category</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedData.slice(0, 50).map((row, index) => (
                                                <tr
                                                    key={index}
                                                    className={`border-t ${!row.isValid ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                                                >
                                                    <td className="px-2 py-2">
                                                        {row.isValid ? (
                                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                        ) : (
                                                            <div title={row.error}>
                                                                <XCircle className="h-4 w-4 text-red-600" />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">{row.date}</td>
                                                    <td className="px-2 py-2">{row.description}</td>
                                                    <td className="px-2 py-2 text-right">
                                                        {parseFloat(row.amount).toLocaleString()}
                                                    </td>
                                                    <td className="px-2 py-2 capitalize">{row.type}</td>
                                                    <td className="px-2 py-2">{row.category}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {parsedData.length > 50 && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Showing first 50 rows. All {parsedData.length} rows will be imported.
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    /* Import Result */
                    <div className="py-8">
                        {importResult.success ? (
                            <div className="text-center">
                                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Import Successful!</h3>
                                <p className="text-muted-foreground mb-4">
                                    Successfully imported {importResult.successCount} transactions
                                </p>
                                {importResult.failedCount && importResult.failedCount > 0 && (
                                    <p className="text-sm text-orange-600">
                                        {importResult.failedCount} rows failed to import
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="text-center">
                                <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Import Failed</h3>
                                <p className="text-muted-foreground">{importResult.message}</p>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    {!importResult ? (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={!file || parsedData.length === 0 || validCount === 0 || isImporting}
                            >
                                {isImporting ? 'Importing...' : `Import ${validCount} Transactions`}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={handleClose}>Close</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
