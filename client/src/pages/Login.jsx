const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setRegisterGeneralError('')
    setRegisterSuccessMessage('')

    if (!validateRegisterClientSide()) {
      return
    }

    setIsRegistering(true)
    try {
      const result = await registerRequest({
        username: username.trim(),
        password,
        email: email.trim(),
        roleId: DEFAULT_ROLE_ID,
        firstname: firstname.trim(),
        lastname: lastname.trim(),
      })

      if (!result.isError) {
        setRegisterSuccessMessage('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ')

        setFirstname('')
        setLastname('')
        setUsername('')
        setEmail('')
        setPassword('')
        setConfirmPassword('')

        setMode('login')
        return
      }

      if (result.fieldErrors) {
        setRegisterFieldErrors(result.fieldErrors)
      } else {
        setRegisterGeneralError(result.errorMessage)
      }
    } catch (err) {
      console.error(err)
      setRegisterGeneralError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsRegistering(false)
    }
  }