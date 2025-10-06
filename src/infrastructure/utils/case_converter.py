"""
Case conversion utilities.
Migrated from core/utils/case_converter.py.
"""

def camel_case_to_snake_case(input_str: str) -> str:
    """
    Convert camelCase string to snake_case.
    
    Examples:
        >>> camel_case_to_snake_case("SomeSDK")
        'some_sdk'
        >>> camel_case_to_snake_case("RServoDrive")
        'r_servo_drive'
        >>> camel_case_to_snake_case("SDKDemo")
        'sdk_demo'
        >>> camel_case_to_snake_case("UserManagement")
        'user_management'
        >>> camel_case_to_snake_case("APIResponse")
        'api_response'
    
    Args:
        input_str: Input string in camelCase
        
    Returns:
        String converted to snake_case
    """
    if not input_str:
        return input_str
    
    chars = []
    for c_idx, char in enumerate(input_str):
        if c_idx and char.isupper():
            nxt_idx = c_idx + 1
            # Idea of the flag is to separate abbreviations
            # as new words, show them in lower case
            flag = nxt_idx >= len(input_str) or input_str[nxt_idx].isupper()
            prev_char = input_str[c_idx - 1]
            if prev_char.isupper() and flag:
                pass
            else:
                chars.append("_")
        chars.append(char.lower())
    return "".join(chars)


def snake_case_to_camel_case(input_str: str) -> str:
    """
    Convert snake_case string to camelCase.
    
    Examples:
        >>> snake_case_to_camel_case("some_sdk")
        'someSdk'
        >>> snake_case_to_camel_case("user_management")
        'userManagement'
        >>> snake_case_to_camel_case("api_response")
        'apiResponse'
    
    Args:
        input_str: Input string in snake_case
        
    Returns:
        String converted to camelCase
    """
    if not input_str:
        return input_str
    
    components = input_str.split('_')
    return components[0] + ''.join(word.capitalize() for word in components[1:])


def snake_case_to_pascal_case(input_str: str) -> str:
    """
    Convert snake_case string to PascalCase.
    
    Examples:
        >>> snake_case_to_pascal_case("some_sdk")
        'SomeSdk'
        >>> snake_case_to_pascal_case("user_management")
        'UserManagement'
        >>> snake_case_to_pascal_case("api_response")
        'ApiResponse'
    
    Args:
        input_str: Input string in snake_case
        
    Returns:
        String converted to PascalCase
    """
    if not input_str:
        return input_str
    
    components = input_str.split('_')
    return ''.join(word.capitalize() for word in components)


def pascal_case_to_snake_case(input_str: str) -> str:
    """
    Convert PascalCase string to snake_case.
    
    Examples:
        >>> pascal_case_to_snake_case("SomeSdk")
        'some_sdk'
        >>> pascal_case_to_snake_case("UserManagement")
        'user_management'
        >>> pascal_case_to_snake_case("APIResponse")
        'api_response'
    
    Args:
        input_str: Input string in PascalCase
        
    Returns:
        String converted to snake_case
    """
    return camel_case_to_snake_case(input_str)
