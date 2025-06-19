import React, { useState } from 'react';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import Purchases from 'react-native-purchases';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedText } from './ThemedText';

interface PaywallProps {
    onSuccess?: () => void;
    onClose?: () => void;
    offerings?: any;
}

export function Paywall({ onSuccess, onClose, offerings }: PaywallProps) {
    const { user } = useAuth();
    const [showATMModal, setShowATMModal] = useState(false);

    const showPaywall = async () => {
        if (!user?.uid) return;

        try {

            // Set the current user's UID as the RevenueCat identifier
            await Purchases.logIn(user.uid);

            // If no offerings provided, fetch them
            const currentOfferings = offerings || (await Purchases.getOfferings()).current;
            if (!currentOfferings) {
                throw new Error('No offerings available');
            }

            const result = await RevenueCatUI.presentPaywall({
                offering: currentOfferings,
                displayCloseButton: true,
            });

            // Check if purchase was successful
            if (result === PAYWALL_RESULT.PURCHASED) {


                // Wait a brief moment to show the success state
                await new Promise(resolve => setTimeout(resolve, 1000));
                onSuccess?.();
            } else {

                setShowATMModal(true);
            }
        } catch (error) {

            console.error('Failed to show paywall:', error);
            setShowATMModal(true);
        }
    };

    const handleATMModalClose = () => {
        setShowATMModal(false);
        onClose?.();
    };

    // Show paywall immediately when component mounts
    React.useEffect(() => {
        showPaywall();
    }, []);

    return (
        <>
            <ThemedText>Paywall</ThemedText>
        </>
    );
} 