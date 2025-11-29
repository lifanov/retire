import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Wizard, DEFAULT_WIZARD_DATA, type WizardData } from './Wizard';
import userEvent from '@testing-library/user-event';

describe('Wizard Component', () => {
    it('should update HSA savings and advance step correctly in Step 4', async () => {
        const user = userEvent.setup();
        // Start at Step 4
        const initialData: WizardData = {
            ...DEFAULT_WIZARD_DATA,
            step: 4,
            savingsCash: 0,
            savingsPreTax: 0,
            investmentsPostTax: 0,
            savingsRoth: 0,
            savingsHSA: 0
        };

        const setDataMock = vi.fn();

        render(
            <Wizard data={initialData} setData={setDataMock} onComplete={vi.fn()} />
        );

        // 1. "Show Breakdown" is true by default.
        const editBtn = screen.getByText(/Edit/i);
        await user.click(editBtn);

        // 2. Enter HSA Amount
        const inputs = screen.getAllByRole('spinbutton');
        const hsaInput = inputs[inputs.length - 1];

        await user.type(hsaInput, '50000');

        // 3. Click Next
        const nextBtn = screen.getByText('Next');
        await user.click(nextBtn);

        // Analyze calls
        const calls = setDataMock.mock.calls;
        const lastCallData = calls[calls.length - 1][0] as WizardData;

        // Assertions
        expect(lastCallData.step).toBe(5);
        expect(lastCallData.savingsHSA).toBe(50000);
    });

    it('should show Start Over link and reset data when clicked', async () => {
        const user = userEvent.setup();
        const initialData: WizardData = { ...DEFAULT_WIZARD_DATA, step: 2 }; // Any step
        const setDataMock = vi.fn();

        render(
             <Wizard data={initialData} setData={setDataMock} onComplete={vi.fn()} />
        );

        const startOverLink = screen.getByText(/Start Over/i);
        expect(startOverLink).toBeTruthy();

        await user.click(startOverLink);

        // Expect reset to default
        expect(setDataMock).toHaveBeenCalledWith(DEFAULT_WIZARD_DATA);
    });
});
