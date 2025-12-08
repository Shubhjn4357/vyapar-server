import { z } from 'zod';

export interface GSTCalculationParams {
    amount: number;
    gstRate: number;
    placeOfSupply?: string;
    reverseCharge?: boolean;
    isInterState?: boolean;
    isExport?: boolean;
}

export interface GSTBreakdown {
    taxableAmount: number;
    cgstAmount: number;
    cgstRate: number;
    sgstAmount: number;
    sgstRate: number;
    igstAmount: number;
    igstRate: number;
    cessAmount: number;
    cessRate: number;
    totalTaxAmount: number;
    totalAmount: number;
}

/**
 * GST Calculator Service
 * Handles all GST calculation logic based on Indian GST rules
 */
export class GSTCalculator {
    private static readonly GST_RATES = {
        0: 0,
        5: 5,
        12: 12,
        18: 18,
        28: 28,
    };

    private static readonly CESS_RATES: { [key: number]: number } = {
        5: 0,
        12: 0,
        18: 0,
        28: 0,
    };

    /**
     * Calculate GST breakdown for a transaction
     * Returns CGST + SGST for intrastate, IGST for interstate
     */
    static calculateGST(params: GSTCalculationParams): GSTBreakdown {
        const {
            amount,
            gstRate,
            placeOfSupply,
            reverseCharge = false,
            isInterState = false,
            isExport = false,
        } = params;

        const taxableAmount = amount;

        // Exports are zero-rated
        if (isExport) {
            return {
                taxableAmount,
                cgstAmount: 0,
                cgstRate: 0,
                sgstAmount: 0,
                sgstRate: 0,
                igstAmount: 0,
                igstRate: 0,
                cessAmount: 0,
                cessRate: 0,
                totalTaxAmount: 0,
                totalAmount: taxableAmount,
            };
        }

        // Reverse charge mechanism - applicable for specific cases
        if (reverseCharge) {
            return {
                taxableAmount,
                cgstAmount: 0,
                cgstRate: 0,
                sgstAmount: 0,
                sgstRate: 0,
                igstAmount: 0,
                igstRate: 0,
                cessAmount: 0,
                cessRate: 0,
                totalTaxAmount: 0,
                totalAmount: taxableAmount,
            };
        }

        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        const cessRate = this.CESS_RATES[gstRate] || 0;
        const cessAmount = (taxableAmount * cessRate) / 100;

        if (isInterState) {
            // Interstate transaction - IGST only
            igstAmount = (taxableAmount * gstRate) / 100;
        } else {
            // Intrastate transaction - Split CGST and SGST
            const halfRate = gstRate / 2;
            cgstAmount = (taxableAmount * halfRate) / 100;
            sgstAmount = (taxableAmount * halfRate) / 100;
        }

        const totalTaxAmount = cgstAmount + sgstAmount + igstAmount + cessAmount;

        return {
            taxableAmount,
            cgstAmount: Math.round(cgstAmount * 100) / 100,
            cgstRate: isInterState ? 0 : gstRate / 2,
            sgstAmount: Math.round(sgstAmount * 100) / 100,
            sgstRate: isInterState ? 0 : gstRate / 2,
            igstAmount: Math.round(igstAmount * 100) / 100,
            igstRate: isInterState ? gstRate : 0,
            cessAmount: Math.round(cessAmount * 100) / 100,
            cessRate,
            totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
            totalAmount: Math.round((taxableAmount + totalTaxAmount) * 100) / 100,
        };
    }

    /**
     * Calculate GST for multiple line items
     */
    static calculateLineItems(items: Array<{
        amount: number;
        gstRate: number;
        isInterState?: boolean;
        reverseCharge?: boolean;
    }>) {
        return items.map(item =>
            this.calculateGST({
                amount: item.amount,
                gstRate: item.gstRate,
                isInterState: item.isInterState || false,
                reverseCharge: item.reverseCharge || false,
            })
        );
    }

    /**
     * Calculate aggregate GST across multiple items
     */
    static calculateAggregate(
        items: Array<{
            amount: number;
            gstRate: number;
            isInterState?: boolean;
            reverseCharge?: boolean;
        }>
    ) {
        const breakdowns = this.calculateLineItems(items);

        return {
            totalTaxableAmount: breakdowns.reduce((sum, b) => sum + b.taxableAmount, 0),
            totalCGST: breakdowns.reduce((sum, b) => sum + b.cgstAmount, 0),
            totalSGST: breakdowns.reduce((sum, b) => sum + b.sgstAmount, 0),
            totalIGST: breakdowns.reduce((sum, b) => sum + b.igstAmount, 0),
            totalCess: breakdowns.reduce((sum, b) => sum + b.cessAmount, 0),
            totalTax: breakdowns.reduce((sum, b) => sum + b.totalTaxAmount, 0),
            grandTotal: breakdowns.reduce((sum, b) => sum + b.totalAmount, 0),
            itemBreakdowns: breakdowns,
        };
    }

    /**
     * Determine if transaction is interstate based on place of supply
     */
    static isInterState(supplierState: string, placeOfSupply: string): boolean {
        return supplierState.toLowerCase() !== placeOfSupply.toLowerCase();
    }

    /**
     * Validate GST rate
     */
    static isValidGSTRate(rate: number): boolean {
        return Object.keys(this.GST_RATES).includes(rate.toString());
    }

    /**
     * Get available GST rates
     */
    static getAvailableRates(): number[] {
        return Object.values(this.GST_RATES);
    }

    /**
     * Calculate reverse charge applicable amount
     * Applicable for specific services and by specific entities
     */
    static calculateReverseCharge(
        amount: number,
        gstRate: number,
        supplier: { type: string; state: string },
        recipient: { state: string }
    ): { isApplicable: boolean; amount: number } {
        // Simplified logic - in production, check service type, recipient type, etc.
        const isApplicable =
            supplier.state.toLowerCase() !== recipient.state.toLowerCase() &&
            ['service', 'specific-goods'].includes(supplier.type.toLowerCase());

        return {
            isApplicable,
            amount: isApplicable ? amount : 0,
        };
    }

    /**
     * Calculate Input Tax Credit (ITC)
     * ITC is available on input purchases (IGST/CGST/SGST)
     */
    static calculateITC(params: {
        cgstPaid: number;
        sgstPaid: number;
        igstPaid: number;
        isEligible: boolean;
        reverseCharge: boolean;
    }): number {
        if (!params.isEligible || params.reverseCharge) {
            return 0;
        }

        return (
            params.cgstPaid +
            params.sgstPaid +
            params.igstPaid
        );
    }

    /**
     * Calculate tax liability for a period
     */
    static calculateNetLiability(
        outwardSupplies: { cgst: number; sgst: number; igst: number; cess: number },
        inwardSupplies: { cgst: number; sgst: number; igst: number; cess: number },
        itcAvailable: number
    ) {
        const totalOutwardTax =
            outwardSupplies.cgst +
            outwardSupplies.sgst +
            outwardSupplies.igst +
            outwardSupplies.cess;

        const itcUtilizable = Math.min(itcAvailable, totalOutwardTax);
        const netLiability = totalOutwardTax - itcUtilizable;

        return {
            outwardTax: totalOutwardTax,
            itcAvailable,
            itcUtilizable,
            netLiability: Math.max(0, netLiability),
            refundable: Math.max(0, itcUtilizable - totalOutwardTax),
        };
    }

    /**
     * Validate GSTIN format (Indian GST Identification Number)
     * Format: 2 State Code + 10 PAN + 1 Entity + 1 Check Digit = 15 chars
     */
    static validateGSTIN(gstin: string): boolean {
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        return gstinRegex.test(gstin.toUpperCase());
    }

    /**
     * Extract state code from GSTIN
     */
    static getStateFromGSTIN(gstin: string): string | null {
        if (!this.validateGSTIN(gstin)) {
            return null;
        }

        const stateCode = gstin.substring(0, 2);
        const states: { [key: string]: string } = {
            '01': 'ANDHRA PRADESH',
            '02': 'ARUNACHAL PRADESH',
            '03': 'ASSAM',
            '04': 'BIHAR',
            '05': 'CHHATTISGARH',
            '06': 'GOA',
            '07': 'GUJARAT',
            '08': 'HARYANA',
            '09': 'HIMACHAL PRADESH',
            '10': 'JHARKHAND',
            '11': 'KARNATAKA',
            '12': 'KERALA',
            '13': 'MADHYA PRADESH',
            '14': 'MAHARASHTRA',
            '15': 'MANIPUR',
            '16': 'MEGHALAYA',
            '17': 'MIZORAM',
            '18': 'NAGALAND',
            '19': 'ODISHA',
            '20': 'PUDUCHERRY',
            '21': 'PUNJAB',
            '22': 'RAJASTHAN',
            '23': 'SIKKIM',
            '24': 'TAMIL NADU',
            '25': 'TELANGANA',
            '26': 'TRIPURA',
            '27': 'UTTAR PRADESH',
            '28': 'UTTARAKHAND',
            '29': 'WEST BENGAL',
            '30': 'UNION TERRITORY',
            '97': 'OVERSEAS',
            '98': 'OTHER',
            '99': 'UNASSIGNED',
        };

        return states[stateCode] || null;
    }
}
