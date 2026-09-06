import api from "./setup"
const URL = import.meta.env.VITE_BASE_URL;
const loginApi = async ({ email, password }) => {
    try {
        return await api.post(`${URL}/user/login`, { email, password })
    } catch (error) {
        throw error
    }
}

const signupApi = async ({ email, password }) => {
    try {
        return await api.post("/user/signup", { email, password })
    } catch (error) {
        throw error
    }
}