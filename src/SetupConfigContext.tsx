// SetupConfigContext.tsx

import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import { UIConfig, BackendConfig } from './types';
import { defaultUIConfig, defaultBackendConfig } from './default-setup-configs';
import { SetupConfigState } from './types';

type SetupConfigAction =
    | { type: 'SET_ACTIVE_UI_CONFIG'; payload: UIConfig }
    | { type: 'SET_ACTIVE_BACKEND_CONFIG'; payload: BackendConfig }
    | { type: 'SET_ALL_UI_CONFIGS'; payload: UIConfig[] }
    | { type: 'SET_ALL_BACKEND_CONFIGS'; payload: BackendConfig[] };

const initialState: SetupConfigState = {
    activeUIConfig: defaultUIConfig,
    activeBackendConfig: defaultBackendConfig,
    allUIConfigs: [],
    allBackendConfigs: []
};

const SetupConfigContext = createContext<SetupConfigState | undefined>(undefined);
const SetupConfigDispatchContext = createContext<React.Dispatch<SetupConfigAction> | undefined>(undefined);

function setupConfigReducer(state: SetupConfigState, action: SetupConfigAction): SetupConfigState {
    switch (action.type) {
        case 'SET_ACTIVE_UI_CONFIG':
            return { ...state, activeUIConfig: action.payload };
        case 'SET_ACTIVE_BACKEND_CONFIG':
            return { ...state, activeBackendConfig: action.payload };
        case 'SET_ALL_UI_CONFIGS':
            return { ...state, allUIConfigs: action.payload };
        case 'SET_ALL_BACKEND_CONFIGS':
            return { ...state, allBackendConfigs: action.payload };
        default:
            throw new Error(`Unhandled action type: ${action}`);
    }
}

export const SetupConfigProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(setupConfigReducer, initialState);

    return (
        <SetupConfigContext.Provider value={state}>
            <SetupConfigDispatchContext.Provider value={dispatch}>
                {children}
            </SetupConfigDispatchContext.Provider>
        </SetupConfigContext.Provider>
    );
};

export const useSetupConfigState = () => {
    const context = useContext(SetupConfigContext);
    if (context === undefined) {
        throw new Error('useSetupConfigState must be used within a SetupConfigProvider');
    }
    return context;
};

export const useSetupConfigDispatch = () => {
    const context = useContext(SetupConfigDispatchContext);
    if (context === undefined) {
        throw new Error('useSetupConfigDispatch must be used within a SetupConfigProvider');
    }
    return context;
};
